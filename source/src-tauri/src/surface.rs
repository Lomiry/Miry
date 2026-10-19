use serde::Deserialize;
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::Manager;

#[derive(Default)]
pub struct Surface(AtomicUsize);
impl Surface {
    pub(crate) fn handle(&self) -> usize {
        self.0.load(Ordering::Acquire)
    }
}
#[cfg(windows)]
fn pointer_sample(window: &tauri::WebviewWindow) -> Option<((i32, i32), bool)> {
    use windows_sys::Win32::{
        Foundation::{POINT, RECT},
        UI::WindowsAndMessaging::*,
    };
    let surface = window.state::<Surface>().0.load(Ordering::Acquire);
    if surface == 0 {
        return None;
    }
    let parent = window.hwnd().ok()?.0;
    unsafe {
        // mpv disables mouse input on its renderer when embedded with --wid.
        // Check only our visible video and foreground owner, never global activity.
        if GetForegroundWindow() != parent
            || IsIconic(parent) != 0
            || IsWindowVisible(surface as _) == 0
        {
            return None;
        }
        let mut point = POINT { x: 0, y: 0 };
        let mut bounds: RECT = std::mem::zeroed();
        if GetCursorPos(&mut point) == 0 || GetWindowRect(surface as _, &mut bounds) == 0 {
            return None;
        }
        Some((
            (point.x, point.y),
            point.x >= bounds.left
                && point.x < bounds.right
                && point.y >= bounds.top
                && point.y < bounds.bottom,
        ))
    }
}
#[cfg(windows)]
pub fn watch_pointer(window: tauri::WebviewWindow) {
    use tauri::Emitter;
    tauri::async_runtime::spawn(async move {
        let mut previous = None;
        loop {
            if window.hwnd().is_err() {
                break;
            }
            let sample = pointer_sample(&window);
            let point = sample.map(|s| s.0);
            // Remember positions outside the video too: expanding the video under
            // a stationary cursor after Hide must not immediately wake the controls.
            if sample.is_some_and(|s| s.1) && previous.is_some() && point != previous {
                let _ = window.emit("player-controls", "pointer");
            }
            previous = point;
            // Sleeping windows and pages without visible video do almost no work.
            tokio::time::sleep(std::time::Duration::from_millis(if sample.is_some() {
                150
            } else {
                600
            }))
            .await;
        }
    });
}
#[derive(Clone, Default, Deserialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub visible: bool,
}
impl Rect {
    fn valid(&self) -> bool {
        [self.x, self.y, self.width, self.height]
            .iter()
            .all(|n| n.is_finite() && n.abs() <= 32768.0)
            && self.width >= 0.0
            && self.height >= 0.0
    }
}
#[cfg(windows)]
pub unsafe fn create_child(parent: usize) -> Result<usize, String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::*;
    let class: Vec<u16> = "STATIC\0".encode_utf16().collect();
    let child = CreateWindowExW(
        0,
        class.as_ptr(),
        class.as_ptr(),
        WS_CHILD | WS_CLIPCHILDREN | WS_CLIPSIBLINGS | 4,
        0,
        0,
        1,
        1,
        parent as _,
        std::ptr::null_mut(),
        std::ptr::null_mut(),
        std::ptr::null(),
    );
    if child.is_null() {
        Err("无法创建视频画面，请切换到独立窗口播放。".into())
    } else {
        Ok(child as usize)
    }
}
#[tauri::command]
pub async fn player_surface(window: tauri::WebviewWindow, rect: Rect) -> Result<u32, String> {
    if !rect.valid() {
        return Err("视频区域参数无效".into());
    }
    let (send, receive) = tokio::sync::oneshot::channel();
    let owner = window.clone();
    window
        .run_on_main_thread(move || {
            #[cfg(windows)]
            let result = (|| {
                use windows_sys::Win32::UI::WindowsAndMessaging::*;
                let state = owner.state::<Surface>();
                let mut handle = state.0.load(Ordering::Acquire);
                if handle == 0 {
                    if !rect.visible && rect.width == 0.0 {
                        return Ok(0);
                    }
                    let parent = owner.hwnd().map_err(|e| e.to_string())?.0 as usize;
                    handle = unsafe { create_child(parent)? };
                    state.0.store(handle, Ordering::Release);
                }
                let scale = owner.scale_factor().map_err(|e| e.to_string())?;
                unsafe {
                    if rect.visible && rect.width > 0.0 && rect.height > 0.0 {
                        if SetWindowPos(
                            handle as _,
                            HWND_TOP,
                            (rect.x * scale).round() as i32,
                            (rect.y * scale).round() as i32,
                            (rect.width * scale).round() as i32,
                            (rect.height * scale).round() as i32,
                            SWP_NOACTIVATE | SWP_SHOWWINDOW,
                        ) == 0
                        {
                            return Err("无法调整视频区域".into());
                        }
                    } else {
                        ShowWindow(handle as _, SW_HIDE);
                    }
                }
                Ok(handle as u32)
            })();
            #[cfg(not(windows))]
            let result: Result<u32, String> = Err("当前平台尚未支持嵌入播放".into());
            let _ = send.send(result);
        })
        .map_err(|e| e.to_string())?;
    receive.await.map_err(|_| "无法连接视频窗口".to_string())?
}

pub async fn ensure(window: tauri::WebviewWindow) -> Result<u32, String> {
    // The UI places and shows this surface after mpv has loaded the video.
    player_surface(
        window,
        Rect {
            width: 1.0,
            height: 1.0,
            visible: false,
            ..Default::default()
        },
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_non_finite_or_unbounded_video_rectangles() {
        assert!(!Rect {
            width: f64::NAN,
            ..Default::default()
        }
        .valid());
        assert!(!Rect {
            height: -1.0,
            ..Default::default()
        }
        .valid());
        assert!(!Rect {
            x: 50000.0,
            ..Default::default()
        }
        .valid());
        assert!(Rect {
            x: 20.0,
            y: 64.0,
            width: 1000.0,
            height: 500.0,
            visible: true
        }
        .valid());
    }
}

#[cfg(all(test, windows))]
pub struct TestSurface {
    pub handle: usize,
    stop: std::sync::Arc<std::sync::atomic::AtomicBool>,
    thread: Option<std::thread::JoinHandle<()>>,
}
#[cfg(all(test, windows))]
impl TestSurface {
    pub fn new() -> Self {
        let stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let ended = stop.clone();
        let (send, receive) = std::sync::mpsc::channel();
        let thread = std::thread::spawn(move || unsafe {
            use windows_sys::Win32::UI::WindowsAndMessaging::*;
            let class: Vec<u16> = "STATIC\0".encode_utf16().collect();
            let parent = CreateWindowExW(
                0,
                class.as_ptr(),
                class.as_ptr(),
                WS_OVERLAPPEDWINDOW,
                0,
                0,
                700,
                500,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null(),
            );
            assert!(!parent.is_null());
            let child = create_child(parent as usize).unwrap();
            SetWindowPos(
                child as _,
                HWND_TOP,
                20,
                20,
                640,
                360,
                SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
            send.send(child).unwrap();
            let mut message = std::mem::zeroed();
            while !ended.load(Ordering::Relaxed) {
                while PeekMessageW(&mut message, std::ptr::null_mut(), 0, 0, PM_REMOVE) != 0 {
                    TranslateMessage(&message);
                    DispatchMessageW(&message);
                }
                std::thread::sleep(std::time::Duration::from_millis(5));
            }
            DestroyWindow(parent);
        });
        Self {
            handle: receive.recv().unwrap(),
            stop,
            thread: Some(thread),
        }
    }
}
#[cfg(all(test, windows))]
impl Drop for TestSurface {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}
