#[tokio::test]
async fn track_selection_is_property_only_idempotent_and_reports_failures() {
    let (tx, mut requests) = mpsc::channel::<Rpc>(24);
    let worker = tokio::spawn(async move {
        let mut properties = HashMap::from([
            ("sid".to_string(), json!(1)),
            ("aid".to_string(), json!(1)),
            ("secondary-sid".to_string(), json!(2)),
        ]);
        let mut commands = Vec::new();
        while let Some(request) = requests.recv().await {
            let property = request.command[1].as_str().unwrap().to_string();
            commands.push(request.command.clone());
            let result = if request.command[0] == "get_property" {
                Ok(properties[&property].clone())
            } else if request.command[2] == 9999 {
                Err("controlled track rejection".into())
            } else {
                properties.insert(property, request.command[2].clone());
                Ok(Value::Null)
            };
            let _ = request.reply.send(result);
        }
        commands
    });
    select_track(&tx, "subtitle", 1).await.unwrap();
    select_track(&tx, "subtitle", 2).await.unwrap();
    select_track(&tx, "audio", 2).await.unwrap();
    select_track(&tx, "audio", 2).await.unwrap();
    assert!(select_track(&tx, "audio", 9999).await.is_err());
    assert_eq!(
        rpc(&tx, json!(["get_property", "aid"])).await.unwrap(),
        json!(2)
    );
    drop(tx);
    let commands = worker.await.unwrap();
    assert!(commands.iter().all(|c| ["get_property", "set_property"]
        .contains(&c[0].as_str().unwrap())
        && ["sid", "aid", "secondary-sid"].contains(&c[1].as_str().unwrap())));
    let rejected = commands
        .iter()
        .position(|c| c[0] == "set_property" && c[2] == 9999)
        .unwrap();
    assert_eq!(
        commands[..rejected]
            .iter()
            .filter(|c| c[0] == "set_property" && c[1] == "aid" && c[2] == 2)
            .count(),
        1
    );
}
#[tokio::test]
async fn subtitle_fetch_rejects_other_origins_and_has_nonfatal_bounded_failure() {
    let files = Arc::new(SubtitleFiles::default());
    let mut a = launch();
    let invalid = Subtitle {
        url: "http://elsewhere.example.test/sub.srt".into(),
        index: 0,
        title: "fixture".into(),
        language: "en".into(),
    };
    assert!(fetch_subtitle(&a, &invalid, &files).await.is_err());
    assert!(files.0.lock().unwrap().is_empty());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    a.server = format!("http://{}", listener.local_addr().unwrap());
    a.subtitles = vec![Subtitle {
        url: format!("{}/sub.srt", a.server),
        ..invalid
    }];
    let service = tokio::spawn(async move {
        let (socket, _) = listener.accept().await.unwrap();
        let (read, mut write) = socket.into_split();
        let mut reader = BufReader::new(read);
        loop {
            let mut line = String::new();
            if reader.read_line(&mut line).await.unwrap() == 0 || line == "\r\n" {
                break;
            }
        }
        write
            .write_all(b"HTTP/1.1 500 Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .await
            .unwrap();
    });
    let (sender, _) = watch::channel(Snapshot {
        active: true,
        loaded: true,
        position: 12.,
        ..Default::default()
    });
    let sender = Arc::new(sender);
    let (tx, mut requests) = mpsc::channel(4);
    load_external_subtitles(
        tx,
        Arc::new(TrackSelection::default()),
        sender.clone(),
        a,
        files.clone(),
        0,
    )
    .await;
    service.await.unwrap();
    assert!(sender.borrow().active);
    assert!(sender.borrow().subtitle_load_failed);
    assert!(sender.borrow().error.is_empty());
    assert_eq!(sender.borrow().position, 12.);
    assert!(requests.try_recv().is_err());
    assert!(files.0.lock().unwrap().is_empty());
}

#[cfg(windows)]
#[tokio::test]
#[ignore = "requires bundled mpv and MIRY_TEST_TRACKS; local multi-track continuity"]
async fn real_mpv_track_properties_preserve_the_video_session() {
    let (server, _, task) = mock_server().await;
    let mut a = launch();
    a.server = server;
    a.url = std::env::var("MIRY_TEST_TRACKS").unwrap();
    a.speed = 1.5;
    a.volume = Some(37.);
    a.play_session_id = "controlled-tracks".into();
    let surface = crate::surface::TestSurface::new();
    a.window_id = Some(surface.handle as u32);
    let mut h = start(mpv_path().unwrap(), a, true).await.unwrap();
    wait_state(&mut h, |s| {
        s.loaded && s.position > 0.2 && s.tracks.len() >= 5
    })
    .await;
    let original = h.snapshot.borrow().play_session_id.clone();
    for (kind, id) in [
        ("subtitle", 2),
        ("subtitle", -1),
        ("subtitle", 1),
        ("audio", 2),
        ("audio", 1),
    ] {
        let before = h.snapshot.borrow().position;
        let began = Instant::now();
        select_track(&h.tx, kind, id).await.unwrap();
        wait_state(&mut h, |s| s.position > before + 0.1).await;
        let state = h.snapshot.borrow().clone();
        assert_eq!(state.play_session_id, original);
        assert!(state.active && !state.paused);
        assert!((state.speed - 1.5).abs() < 0.01);
        assert!((state.volume - 37.).abs() < 0.1);
        assert!(state.position >= before);
        assert_eq!(surface.handle, a_surface(&h).await);
        eprintln!(
            "controlled {kind}={id}: advancing, elapsed={}ms",
            began.elapsed().as_millis()
        );
    }
    rpc(&h.tx, json!(["set_property", "pause", true]))
        .await
        .unwrap();
    select_track(&h.tx, "subtitle", 2).await.unwrap();
    select_track(&h.tx, "audio", 2).await.unwrap();
    assert_eq!(
        rpc(&h.tx, json!(["get_property", "pause"])).await.unwrap(),
        json!(true)
    );
    assert!(select_track(&h.tx, "audio", 9999).await.is_err());
    stop_handle(&mut h).await.unwrap();
    task.abort();
}

#[tokio::test]
async fn stopping_a_scope_cancels_pending_subtitle_io_without_submitting_mpv_commands() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let mut a = launch();
    a.server = format!("http://{}", listener.local_addr().unwrap());
    a.subtitles = vec![Subtitle {
        url: format!("{}/waiting.srt", a.server),
        index: 1,
        title: "controlled".into(),
        language: "eng".into(),
    }];
    let (entered, waiting) = oneshot::channel();
    let (release, gate) = oneshot::channel::<()>();
    let server = tokio::spawn(async move {
        let (socket, _) = listener.accept().await.unwrap();
        let (read, _write) = socket.into_split();
        let mut reader = BufReader::new(read);
        loop {
            let mut line = String::new();
            if reader.read_line(&mut line).await.unwrap() == 0 || line == "\r\n" {
                break;
            }
        }
        let _ = entered.send(());
        let _ = gate.await;
    });
    let (sender, _) = watch::channel(Snapshot {
        active: true,
        ..Default::default()
    });
    let sender = Arc::new(sender);
    let files = Arc::new(SubtitleFiles::default());
    let (tx, mut requests) = mpsc::channel(4);
    let worker = tokio::spawn(load_external_subtitles(
        tx,
        Arc::new(TrackSelection::default()),
        sender.clone(),
        a,
        files.clone(),
        0,
    ));
    waiting.await.unwrap();
    sender.send_modify(|state| state.active = false);
    timeout(Duration::from_secs(1), worker)
        .await
        .unwrap()
        .unwrap();
    assert!(requests.try_recv().is_err());
    assert!(files.0.lock().unwrap().is_empty());
    drop(release);
    server.await.unwrap();
}
#[cfg(windows)]
async fn a_surface(h: &Handle) -> usize {
    rpc(&h.tx, json!(["get_property", "wid"]))
        .await
        .unwrap()
        .as_i64()
        .unwrap() as usize
}

#[cfg(windows)]
#[tokio::test]
#[ignore = "requires bundled mpv and MIRY_TEST_TRACKS; controlled external subtitle I/O"]
async fn real_mpv_slow_subtitle_io_does_not_block_the_playback_clock() {
    for chosen in [2, -1] {
        use tokio::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let server = format!("http://{}", listener.local_addr().unwrap());
        let address = format!("{server}/controlled.srt");
        let (entered, waiting) = oneshot::channel();
        let entered = Arc::new(std::sync::Mutex::new(Some(entered)));
        let gate = Arc::new(tokio::sync::Notify::new());
        let release = gate.clone();
        let service = tokio::spawn(async move {
            loop {
                let (socket, _) = listener.accept().await.unwrap();
                let entered = entered.clone();
                let gate = gate.clone();
                tokio::spawn(async move {
                    let (read, mut write) = socket.into_split();
                    let mut reader = BufReader::new(read);
                    let mut request = String::new();
                    reader.read_line(&mut request).await.unwrap();
                    loop {
                        let mut line = String::new();
                        if reader.read_line(&mut line).await.unwrap() == 0 || line == "\r\n" {
                            break;
                        }
                    }
                    let body = if request.contains("controlled.srt") {
                        if let Some(entered) = entered.lock().unwrap().take() {
                            let _ = entered.send(());
                        }
                        gate.notified().await;
                        "1\n00:00:00,000 --> 00:00:20,000\nControlled external subtitle\n"
                    } else {
                        "{}"
                    };
                    let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = write.write_all(response.as_bytes()).await;
                });
            }
        });
        let mut a = launch();
        a.server = server;
        a.url = std::env::var("MIRY_TEST_TRACKS").unwrap();
        a.subtitles = vec![Subtitle {
            url: address,
            index: 99,
            title: "Controlled external".into(),
            language: "eng".into(),
        }];
        a.subtitle_index = Some(99);
        let mut h = start(mpv_path().unwrap(), a, true).await.unwrap();
        wait_state(&mut h, |s| s.loaded && s.position > 0.2).await;
        timeout(Duration::from_secs(2), waiting)
            .await
            .unwrap()
            .unwrap();
        let before = h.snapshot.borrow().position;
        let clock = timeout(
            Duration::from_millis(300),
            rpc(&h.tx, json!(["get_property", "time-pos"])),
        )
        .await;
        let advancing = timeout(Duration::from_millis(300), async {
            loop {
                if h.snapshot.borrow().position > before + 0.1 {
                    break;
                }
                h.snapshot.changed().await.unwrap();
            }
        })
        .await
        .is_ok();
        h.track_selection
            .subtitle_epoch
            .fetch_add(1, Ordering::SeqCst);
        select_track(&h.tx, "subtitle", chosen).await.unwrap();
        release.notify_one();
        wait_state(&mut h, |s| !s.external_subtitle_indexes.is_empty()).await;
        let expected = if chosen < 0 {
            json!(false)
        } else {
            json!(chosen)
        };
        assert_eq!(
            rpc(&h.tx, json!(["get_property", "sid"])).await.unwrap(),
            expected,
            "late automatic subtitle must not replace the user's choice"
        );
        let paths = h._subtitle_files.0.lock().unwrap().clone();
        assert!(!paths.is_empty());
        stop_handle(&mut h).await.unwrap();
        drop(h);
        service.abort();
        for path in paths {
            assert!(
                !path.exists(),
                "session subtitle temporary file not reclaimed"
            )
        }
        assert!(
            matches!(clock, Ok(Ok(Value::Number(_)))),
            "external subtitle I/O blocked the IPC playback clock"
        );
        assert!(
            advancing,
            "video clock stopped while external subtitle I/O was pending"
        );
    }
}

#[cfg(windows)]
#[test]
#[ignore = "requires an idle isolated Windows desktop, WebView2 and MIRY_TEST_TRACKS"]
fn native_episode_transition_preserves_window_and_surface_ownership() {
    use windows_sys::Win32::UI::WindowsAndMessaging::GetParent;
    let mut context = tauri::test::mock_context::<tauri::Wry, _>(tauri::test::noop_assets());
    context.config_mut().identifier = "com.miry.lifecycle-regression".into();
    let mut app = tauri::Builder::default()
        .any_thread()
        .manage(Player::default())
        .manage(crate::tray::TrayState::default())
        .manage(crate::mini_window::MiniWindow::default())
        .manage(crate::surface::Surface::default())
        .manage(crate::player_ui::OverlayOwner::default())
        .build(context)
        .unwrap();
    let main = tauri::WebviewWindowBuilder::new(
        &app,
        "main",
        tauri::WebviewUrl::External("about:blank".parse().unwrap()),
    )
    .title("Miry isolated lifecycle test")
    .inner_size(640., 360.)
    .data_directory(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".cache/lifecycle-window-regression"),
    )
    .build()
    .unwrap();
    let rect = crate::surface::Rect {
        width: 640.,
        height: 360.,
        visible: true,
        ..Default::default()
    };
    app.state::<crate::mini_window::MiniWindow>()
        .0
        .lock()
        .unwrap()
        .surface = rect.clone();
    crate::surface::update_surface(&main, rect.clone()).unwrap();
    crate::player_ui::player_overlay_attach(main.clone(), "lifecycle-test".into()).unwrap();
    crate::player_ui::update_overlay(main.clone(), rect, Some("lifecycle-test".into())).unwrap();
    let observed = Arc::new(std::sync::Mutex::new(Vec::new()));
    let enabled = Arc::new(AtomicBool::new(false));
    let window = main.clone();
    let trace = observed.clone();
    let recording = enabled.clone();
    main.on_window_event(move |event| {
        if recording.load(Ordering::SeqCst) && matches!(event, tauri::WindowEvent::Resized(_)) {
            trace.lock().unwrap().push((
                window.is_fullscreen().unwrap(),
                window.is_maximized().unwrap(),
            ));
        }
    });
    let handle = app.handle().clone();
    let worker_main = main.clone();
    let worker_enabled = enabled.clone();
    let worker_trace = observed.clone();
    let worker = std::thread::spawn(move || {
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async move {
                let (server, calls, service) = mock_server().await;
                let window = worker_main;
                let app = handle;
                let hwnd = window.hwnd().unwrap().0 as usize;
                let surface = app.state::<crate::surface::Surface>().handle();
                let mut session = String::new();
                for mode in ["fullscreen", "normal", "maximized", "mini"] {
                    let (send, receive) = oneshot::channel();
                    let main = window.clone();
                    window
                        .run_on_main_thread(move || {
                            let result = (|| {
                                set_fullscreen(&main, false)?;
                                main.unmaximize().map_err(|e| e.to_string())?;
                                if mode == "fullscreen" {
                                    set_fullscreen(&main, true)?;
                                }
                                if mode == "maximized" {
                                    main.maximize().map_err(|e| e.to_string())?;
                                }
                                Ok::<(), String>(())
                            })();
                            let _ = send.send(result);
                        })
                        .unwrap();
                    receive.await.unwrap().unwrap();
                    for episode in 0..3 {
                        let geometry = (
                            window.outer_position().unwrap(),
                            window.inner_size().unwrap(),
                        );
                        let prior_mini = crate::mini_window::host(&app).map(|mini| {
                            (
                                mini.hwnd().unwrap().0 as usize,
                                mini.outer_position().unwrap(),
                                mini.inner_size().unwrap(),
                            )
                        });
                        let prior_overlay = app
                            .get_webview_window("player-ui")
                            .map(|overlay| overlay.hwnd().unwrap().0 as usize);
                        if episode > 0 {
                            let process_done = app
                                .state::<Player>()
                                .0
                                .lock()
                                .await
                                .as_ref()
                                .unwrap()
                                .process_done
                                .clone();
                            worker_trace.lock().unwrap().clear();
                            worker_enabled.store(true, Ordering::SeqCst);
                            player_stop(app.state(), window.clone(), Some(true))
                                .await
                                .unwrap();
                            assert!(*process_done.borrow());
                            assert_eq!(window.is_fullscreen().unwrap(), mode == "fullscreen");
                            if mode == "maximized" {
                                assert!(window.is_maximized().unwrap());
                            }
                        }
                        let mut request = launch();
                        request.server = server.clone();
                        request.url = format!("{server}/Videos/movie/stream");
                        request.embedded = true;
                        request.play_session_id = format!("{mode}-{episode}");
                        request.preserve_presentation = episode > 0;
                        request.fullscreen = mode == "fullscreen";
                        player_start(app.state(), window.clone(), request)
                            .await
                            .unwrap();
                        let mut status = app
                            .state::<Player>()
                            .0
                            .lock()
                            .await
                            .as_ref()
                            .unwrap()
                            .snapshot
                            .clone();
                        timeout(Duration::from_secs(5), async {
                            loop {
                                if status.borrow().loaded && status.borrow().position > 0.1 {
                                    break;
                                }
                                status.changed().await.unwrap();
                            }
                        })
                        .await
                        .unwrap();
                        worker_enabled.store(false, Ordering::SeqCst);
                    eprintln!("controlled native {mode} episode={episode}: main={hwnd} surface={surface} fullscreen={} maximized={} resize-events={:?}",window.is_fullscreen().unwrap(),window.is_maximized().unwrap(),worker_trace.lock().unwrap());
                        assert_eq!(window.hwnd().unwrap().0 as usize, hwnd);
                        assert_eq!(app.state::<crate::surface::Surface>().handle(), surface);
                        if episode > 0 {
                            assert_eq!(
                                (
                                    window.outer_position().unwrap(),
                                    window.inner_size().unwrap()
                                ),
                                geometry
                            );
                        }
                        if let Some(overlay) = prior_overlay {
                            assert_eq!(
                                app.get_webview_window("player-ui")
                                    .unwrap()
                                    .hwnd()
                                    .unwrap()
                                    .0 as usize,
                                overlay
                            );
                        }
                        assert_eq!(window.is_fullscreen().unwrap(), mode == "fullscreen");
                        if mode == "fullscreen" {
                            assert!(worker_trace.lock().unwrap().iter().all(|&(full, _)| full));
                        }
                        if mode == "maximized" {
                            assert!(worker_trace.lock().unwrap().iter().all(|&(_, max)| max));
                        }
                        session = status.borrow().play_session_id.clone();
                        if mode == "mini" {
                            if episode == 0 {
                                player_mini(window.clone(), "enter".into(), session.clone())
                                    .await
                                    .unwrap();
                                let mini = crate::mini_window::host(&app).unwrap();
                                mini.set_always_on_top(true).unwrap();
                            }
                            let mini = crate::mini_window::host(&app).unwrap();
                            assert!(mini.is_always_on_top().unwrap());
                            if let Some(geometry) = prior_mini {
                                assert_eq!(
                                    (
                                        mini.hwnd().unwrap().0 as usize,
                                        mini.outer_position().unwrap(),
                                        mini.inner_size().unwrap()
                                    ),
                                    geometry
                                );
                            }
                            assert_eq!(
                                unsafe { GetParent(surface as _) } as usize,
                                mini.hwnd().unwrap().0 as usize
                            );
                            assert!(
                                serde_json::to_value(crate::mini_window::presentation(
                                    &app, &session
                                ))
                                .unwrap()["active"]
                                    == true
                            );
                        }
                    }
                    if mode == "fullscreen" {
                        for requested in [false, true] {
                            player_stop(app.state(), window.clone(), Some(true))
                                .await
                                .unwrap();
                            player_control(
                                app.state(),
                                window.clone(),
                                "fullscreen".into(),
                                Some(if requested { 1. } else { 0. }),
                                None,
                                Some(true),
                            )
                            .await
                            .unwrap();
                            let mut request = launch();
                            request.server = server.clone();
                            request.url = format!("{server}/Videos/movie/stream");
                            request.embedded = true;
                            request.play_session_id = format!("user-mode-{requested}");
                            request.preserve_presentation = true;
                            request.fullscreen = !requested;
                            player_start(app.state(), window.clone(), request)
                                .await
                                .unwrap();
                            assert_eq!(
                                window.is_fullscreen().unwrap(),
                                requested,
                                "stale launch mode overrode the user's choice"
                            );
                        }
                    }
                    if mode == "mini" {
                        player_mini(window.clone(), "leave".into(), session.clone())
                            .await
                            .unwrap();
                    }
                    player_stop(app.state(), window.clone(), None)
                        .await
                        .unwrap();
                    // Real stop disposed the prior controls; recreate only for this fixture's next independent scenario.
                    let (send, receive) = oneshot::channel();
                    let main = window.clone();
                    window
                        .run_on_main_thread(move || {
                            let _ = send.send(crate::player_ui::player_overlay_attach(
                                main,
                                "lifecycle-test".into(),
                            ));
                        })
                        .unwrap();
                    receive.await.unwrap().unwrap();
                }
                let reports = calls.lock().await;
                for id in [
                    "fullscreen-0",
                    "fullscreen-1",
                    "fullscreen-2",
                    "mini-0",
                    "mini-1",
                    "mini-2",
                ] {
                    assert_eq!(
                        reports
                            .iter()
                            .filter(|(path, body)| path.ends_with("/Stopped")
                                && body["PlaySessionId"] == id)
                            .count(),
                        1
                    );
                }
                service.abort();
            });
    });
    let deadline = std::time::Instant::now() + Duration::from_secs(60);
    while !worker.is_finished() && std::time::Instant::now() < deadline {
        #[allow(deprecated)]
        app.run_iteration(|_, _| {});
    }
    assert!(worker.is_finished(), "native lifecycle worker timed out");
    let result = worker.join();
    crate::player_ui::dispose(app.handle()).unwrap();
    main.destroy().unwrap();
    #[allow(deprecated)]
    app.run_iteration(|_, _| {});
    app.cleanup_before_exit();
    result.unwrap();
}
