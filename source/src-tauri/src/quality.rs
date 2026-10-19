//! Quality policy and local mpv extension files. No playback lifecycle is owned here.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tauri::Manager;
pub fn managed_hdr(requested: &str, windows_hdr: Option<bool>) -> &str {
    if requested == "source" && windows_hdr != Some(true) {
        "auto"
    } else {
        requested
    }
}

#[derive(Clone, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Quality {
    pub hdr: String,
    pub hwdec: String,
    pub passthrough: String,
    pub codecs: Vec<String>,
    pub audio_device: String,
    pub mpv_config: bool,
    pub input_config: bool,
    pub extra_args: Vec<String>,
    pub shaders_enabled: bool,
    pub shaders: Vec<String>,
    #[serde(skip)]
    pub directory: Option<PathBuf>,
}
impl Default for Quality {
    fn default() -> Self {
        Self {
            hdr: "auto".into(),
            hwdec: "auto-safe".into(),
            passthrough: "auto".into(),
            codecs: vec!["ac3".into(), "eac3".into(), "dts".into()],
            audio_device: "auto".into(),
            mpv_config: false,
            input_config: false,
            extra_args: vec![],
            shaders_enabled: false,
            shaders: vec![],
            directory: None,
        }
    }
}
impl Quality {
    pub fn validate(&self) -> Result<(), String> {
        if !["auto", "source", "sdr"].contains(&self.hdr.as_str())
            || !["auto", "auto-safe", "no"].contains(&self.hwdec.as_str())
            || !["auto", "on", "off"].contains(&self.passthrough.as_str())
            || self
                .codecs
                .iter()
                .any(|c| !["ac3", "eac3", "dts", "dts-hd", "truehd"].contains(&c.as_str()))
            || self.codecs.len() > 5
            || self.audio_device.len() > 512
            || self.audio_device.contains(['\r', '\n', '\0'])
            || self.shaders.len() > 64
            || self.shaders.iter().any(|s| !shader_name(s))
            || self.extra_args.len() > 32
        {
            return Err("影音设置无效。".into());
        }
        for argument in &self.extra_args {
            // One option per line. Media/network/session/output-window ownership stays in Miry.
            let key = argument
                .strip_prefix("--")
                .and_then(|s| s.split_once('=').map(|v| v.0))
                .ok_or("额外参数需使用 --名称=值，每行一个。")?;
            if argument.len() > 1000
                || argument.contains(['\r', '\n', '\0'])
                || !key.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
                || !extension_option(key)
            {
                return Err(
                    "额外参数仅支持画质、音频与字幕调节，不能覆盖播放会话、认证、窗口或写出媒体。"
                        .into(),
                );
            }
        }
        Ok(())
    }
    pub fn arguments(&self) -> Result<Vec<String>, String> {
        self.validate()?;
        let mut args = vec![
            "--vo=gpu-next".into(),
            "--gpu-api=d3d11".into(),
            "--target-colorspace-hint=auto".into(),
            "--inverse-tone-mapping=no".into(),
            format!("--hwdec={}", self.hwdec),
            format!("--audio-device={}", self.audio_device),
            "--audio-fallback-to-null=yes".into(),
        ];
        if self.hdr == "source" {
            args.extend(["--target-colorspace-hint-mode=source".into()]);
        }
        if self.hdr == "sdr" {
            args.extend(["--target-trc=srgb".into(), "--target-prim=bt.709".into()]);
        }
        args.push(format!(
            "--audio-spdif={}",
            if self.passthrough == "on" {
                self.codecs.join(",")
            } else {
                String::new()
            }
        ));
        if let Some(directory) = &self.directory {
            let config = directory.join("mpv.conf");
            if self.mpv_config && config.is_file() {
                validate_config(&config)?;
                args.push(format!("--include={}", config.to_string_lossy()));
            }
            let input = directory.join("input.conf");
            if self.input_config && input.is_file() {
                validate_input(&input)?;
                args.push(format!("--input-conf={}", input.to_string_lossy()));
            }
            if self.shaders_enabled {
                for name in &self.shaders {
                    let path = directory.join("shaders").join(name);
                    if path.is_file() {
                        args.push(format!("--glsl-shaders-append={}", path.to_string_lossy()));
                    }
                }
            }
        }
        args.extend(self.extra_args.clone());
        Ok(args)
    }
}
fn shader_name(s: &str) -> bool {
    s.len() <= 255 && !s.contains(['/', '\\', ':', '\0']) && s.to_lowercase().ends_with(".glsl")
}
// Both entry points use the same closed set. Unknown options, aliases, list
// mutations and nested configuration/command/filter inputs cannot gain access.
fn extension_option(key: &str) -> bool {
    let key = key.strip_prefix("no-").unwrap_or(key);
    matches!(
        key,
        "hwdec"
            | "hwdec-codecs"
            | "vd-lavc-threads"
            | "vd-lavc-skiploopfilter"
            | "vd-lavc-skipidct"
            | "deinterlace"
            | "scale"
            | "cscale"
            | "dscale"
            | "tscale"
            | "scale-antiring"
            | "cscale-antiring"
            | "scale-radius"
            | "cscale-radius"
            | "dscale-radius"
            | "tscale-radius"
            | "correct-downscaling"
            | "linear-downscaling"
            | "linear-upscaling"
            | "sigmoid-upscaling"
            | "deband"
            | "deband-iterations"
            | "deband-threshold"
            | "deband-range"
            | "deband-grain"
            | "dither-depth"
            | "temporal-dither"
            | "interpolation"
            | "video-sync"
            | "tone-mapping"
            | "tone-mapping-param"
            | "tone-mapping-mode"
            | "hdr-compute-peak"
            | "target-peak"
            | "target-trc"
            | "target-prim"
            | "target-colorspace-hint"
            | "target-colorspace-hint-mode"
            | "inverse-tone-mapping"
            | "brightness"
            | "contrast"
            | "saturation"
            | "gamma"
            | "hue"
            | "video-aspect-override"
            | "video-zoom"
            | "video-pan-x"
            | "video-pan-y"
            | "video-unscaled"
            | "panscan"
            | "speed"
            | "pause"
            | "volume"
            | "mute"
            | "audio-delay"
            | "audio-device"
            | "audio-channels"
            | "audio-spdif"
            | "audio-pitch-correction"
            | "sub-font"
            | "sub-font-size"
            | "sub-scale"
            | "sub-pos"
            | "sub-delay"
            | "sub-color"
            | "sub-border-size"
            | "sub-shadow-offset"
            | "sub-ass-override"
            | "sub-use-margins"
            | "sub-visibility"
            | "secondary-sub-delay"
            | "secondary-sub-visibility"
            | "osd-level"
            | "osd-font"
            | "osd-font-size"
            | "osd-color"
            | "osd-border-size"
            | "osd-duration"
    )
}
fn config_text(path: &std::path::Path, name: &str) -> Result<String, String> {
    if std::fs::metadata(path)
        .map_err(|_| format!("无法读取 {name}。"))?
        .len()
        > 1024 * 1024
    {
        return Err(format!("{name} 超过 1MiB。"));
    }
    let text = std::fs::read_to_string(path).map_err(|_| format!("{name} 需为 UTF-8 文本。"))?;
    if text.len() > 1024 * 1024 || text.contains('\0') {
        return Err(format!("{name} 内容无效。"));
    }
    Ok(text)
}
fn validate_config(path: &std::path::Path) -> Result<(), String> {
    let text = config_text(path, "mpv.conf")?;
    for line in text.lines() {
        if line.trim().is_empty() || line.trim().starts_with('#') {
            continue;
        }
        let key = line
            .trim()
            .split('=')
            .next()
            .unwrap_or("")
            .trim()
            .trim_start_matches("--");
        if !extension_option(key) {
            return Err(
                "mpv.conf 仅支持画质、音频与字幕调节；不支持会话、认证、窗口、写出媒体、脚本或嵌套配置。"
                    .into(),
            );
        }
    }
    Ok(())
}
fn input_property(property: &str) -> bool {
    let property = property.strip_prefix("options/").unwrap_or(property);
    extension_option(property)
        || matches!(
            property,
            "aid" | "sid" | "secondary-sid" | "vid" | "chapter"
        )
}
fn input_command(tokens: &[String]) -> bool {
    let mut tokens = tokens;
    while tokens.first().is_some_and(|t| {
        matches!(
            t.as_str(),
            "osd-auto"
                | "no-osd"
                | "osd-bar"
                | "osd-msg"
                | "osd-msg-bar"
                | "raw"
                | "expand-properties"
                | "repeatable"
                | "nonrepeatable"
                | "async"
                | "sync"
        )
    }) {
        tokens = &tokens[1..];
    }
    let Some(command) = tokens.first() else {
        return false;
    };
    let count = tokens.len();
    match command.as_str() {
        "set" | "add" | "multiply" => count == 3 && input_property(&tokens[1]),
        "cycle" => (2..=3).contains(&count) && input_property(&tokens[1]),
        "cycle-values" => count >= 3 && input_property(&tokens[1]),
        "seek" | "show-text" => (2..=4).contains(&count),
        "sub-step" | "sub-seek" => (2..=3).contains(&count),
        "show-progress" | "revert-seek" | "quit" | "stop" => (1..=2).contains(&count),
        "ignore" | "frame-step" | "frame-back-step" | "ab-loop" => count == 1,
        _ => false,
    }
}
fn input_line(line: &str) -> bool {
    let line = line.trim();
    if line.is_empty() || line.starts_with('#') {
        return true;
    }
    let Some((_, commands)) = line.split_once(char::is_whitespace) else {
        return false;
    };
    let mut commands = commands.trim();
    if commands.starts_with('{') {
        let Some((section, rest)) = commands.split_once(char::is_whitespace) else {
            return false;
        };
        if !section.ends_with('}')
            || !section[1..section.len() - 1]
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        {
            return false;
        }
        commands = rest.trim();
    }
    // Accept plain/quoted arguments and validate every command in a chain.
    // Escapes/custom quotes are rejected rather than interpreted differently by mpv.
    if commands.len() > 4096 || commands.contains(['\\', '`']) {
        return false;
    }
    let mut tokens = Vec::new();
    let mut token = String::new();
    let mut quote = None;
    let mut started = false;
    for c in commands.chars() {
        if let Some(q) = quote {
            if c == q {
                quote = None;
            } else {
                token.push(c);
            }
            continue;
        }
        match c {
            '\'' | '"' => {
                quote = Some(c);
                started = true;
            }
            ';' => {
                if started {
                    tokens.push(std::mem::take(&mut token));
                    started = false;
                }
                if !input_command(&tokens) {
                    return false;
                }
                tokens.clear();
            }
            c if c.is_whitespace() => {
                if started {
                    tokens.push(std::mem::take(&mut token));
                    started = false;
                }
            }
            _ => {
                token.push(c);
                started = true;
            }
        }
        if tokens.len() > 64 {
            return false;
        }
    }
    if quote.is_some() {
        return false;
    }
    if started {
        tokens.push(token);
    }
    input_command(&tokens)
}
fn validate_input(path: &std::path::Path) -> Result<(), String> {
    let text = config_text(path, "input.conf")?;
    if text.lines().any(|line| !input_line(line)) {
        return Err("input.conf 仅支持播放与画质调节命令；不支持外部命令、媒体加载、脚本、写出媒体或复杂转义。".into());
    }
    Ok(())
}
pub fn directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_config_dir()
        .map_err(|_| "无法确定本机配置目录。")?
        .join("mpv");
    std::fs::create_dir_all(path.join("shaders")).map_err(|_| "无法创建 mpv 配置目录。")?;
    Ok(path)
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigFiles {
    directory: String,
    mpv_config: bool,
    input_config: bool,
    shaders: Vec<String>,
}
#[tauri::command]
pub fn mpv_config_files(window: tauri::WebviewWindow) -> Result<ConfigFiles, String> {
    if window.label() != "main" {
        return Err("配置由主窗口管理。".into());
    }
    let path = directory(window.app_handle())?;
    let mut shaders = std::fs::read_dir(path.join("shaders"))
        .map_err(|_| "无法读取 Shader 目录。")?
        .flatten()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_file()))
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|s| shader_name(s))
        .take(64)
        .collect::<Vec<_>>();
    shaders.sort();
    Ok(ConfigFiles {
        directory: path.to_string_lossy().into(),
        mpv_config: path.join("mpv.conf").is_file(),
        input_config: path.join("input.conf").is_file(),
        shaders,
    })
}
#[tauri::command]
pub fn open_mpv_directory(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("配置由主窗口管理。".into());
    }
    let path = directory(window.app_handle())?;
    #[cfg(windows)]
    std::process::Command::new("explorer.exe")
        .arg(path)
        .spawn()
        .map_err(|_| "无法打开配置目录。")?;
    Ok(())
}
#[tauri::command]
pub async fn audio_devices(window: tauri::WebviewWindow) -> Result<Vec<Value>, String> {
    if window.label() != "main" {
        return Err("设备由主窗口管理。".into());
    }
    #[cfg(windows)]
    {
        let path = super::player::mpv_path()?;
        let output = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            tokio::process::Command::new(path)
                .args(["--no-config", "--load-scripts=no", "--audio-device=help"])
                .creation_flags(0x08000000)
                .kill_on_drop(true)
                .output(),
        )
        .await
        .map_err(|_| "音频设备枚举超时。")?
        .map_err(|_| "无法启动音频设备枚举。")?;
        let text = String::from_utf8_lossy(&output.stdout);
        let mut devices = vec![serde_json::json!({"name":"auto","description":"自动"})];
        for line in text.lines().take(128) {
            if let Some(rest) = line.trim().strip_prefix('\'') {
                if let Some((name, label)) = rest.split_once('\'') {
                    if name.starts_with("wasapi/") {
                        devices.push(serde_json::json!({"name":name,"description":label.trim().trim_start_matches('(').trim_end_matches(')')}));
                    }
                }
            }
        }
        Ok(devices)
    }
    #[cfg(not(windows))]
    Ok(vec![])
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn source_hdr_is_only_requested_on_a_known_hdr_desktop() {
        assert_eq!(managed_hdr("source", Some(false)), "auto");
        assert_eq!(managed_hdr("source", None), "auto");
        assert_eq!(managed_hdr("source", Some(true)), "source");
        assert_eq!(managed_hdr("sdr", Some(true)), "sdr");
    }
    #[test]
    fn custom_config_cannot_enable_media_recording() {
        let directory = std::env::temp_dir().join(format!("miry-config-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&directory).unwrap();
        let config = directory.join("mpv.conf");
        std::fs::write(&config, "stream-record=movie.mkv\n").unwrap();
        let q = Quality {
            directory: Some(directory.clone()),
            mpv_config: true,
            ..Default::default()
        };
        assert!(q.arguments().is_err());
        std::fs::remove_file(config).unwrap();
        std::fs::remove_dir(directory).unwrap();
    }
    #[test]
    fn default_uses_gpu_next_and_pcm_not_forced_hdr() {
        let a = Quality::default().arguments().unwrap();
        assert!(a.contains(&"--audio-spdif=".into()));
        assert!(!a.iter().any(|s| s.contains("target-trc=pq")));
    }
    #[test]
    fn custom_options_cannot_take_over_session_or_dump_media() {
        for a in [
            "--wid=123",
            "--stream-dump=movie",
            "--input-ipc-server=other",
            "movie.mkv",
            "--http-header-fields=x",
        ] {
            let q = Quality {
                extra_args: vec![a.into()],
                ..Default::default()
            };
            assert!(q.arguments().is_err(), "{a}");
        }
    }
    #[test]
    fn extension_entry_points_reject_output_commands_and_option_mutations() {
        let directory = std::env::temp_dir().join(format!("miry-options-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&directory).unwrap();
        let config = directory.join("mpv.conf");
        for option in [
            "o=NUL",
            "ovc=libx264",
            "oac=aac",
            "of=matroska",
            "input-conf=unchecked.conf",
            "input-commands=run noop",
            "input-commands-append=run noop",
            "input-commands-add=run noop",
            "scripts-append=other.lua",
            "http-header-fields-append=other",
            "profile=other",
            "profile-cond=true",
            "include=other.conf",
            "vf=lavfi=movie=other.mkv",
            "af=lavfi=amovie=other.mkv",
            "vo=lavc",
            "ao=lavc",
            "write-watch-later-config=yes",
            "screenshot-template=output",
            "unknown-future-option=yes",
        ] {
            let q = Quality {
                extra_args: vec![format!("--{option}")],
                ..Default::default()
            };
            assert!(q.arguments().is_err(), "CLI {option}");
            std::fs::write(&config, format!("# comment\n{option}\n")).unwrap();
            assert!(validate_config(&config).is_err(), "mpv.conf {option}");
        }
        std::fs::write(&config, "[profile]\nspeed=1.5\n").unwrap();
        assert!(validate_config(&config).is_err());
        std::fs::remove_file(config).unwrap();
        std::fs::remove_dir(directory).unwrap();
    }
    #[test]
    fn simple_quality_configs_and_parameters_keep_their_precedence() {
        let directory = std::env::temp_dir().join(format!("miry-quality-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&directory).unwrap();
        std::fs::write(directory.join("mpv.conf"), "# appearance\nspeed=1.25\nhwdec=no\n--deband=yes\nno-interpolation\nsub-font=\"Microsoft YaHei\"\n").unwrap();
        let q = Quality {
            directory: Some(directory.clone()),
            mpv_config: true,
            extra_args: vec!["--speed=1.4".into(), "--sub-scale=1.2".into()],
            ..Default::default()
        };
        let args = q.arguments().unwrap();
        let include = args
            .iter()
            .position(|a| a.starts_with("--include="))
            .unwrap();
        assert!(args.iter().position(|a| a == "--speed=1.4").unwrap() > include);
        std::fs::remove_file(directory.join("mpv.conf")).unwrap();
        std::fs::remove_dir(directory).unwrap();
    }
    #[test]
    fn input_commands_cannot_escape_through_tabs_chains_or_runtime_properties() {
        for line in [
            "r run\tnoop",
            "r run noop",
            "r async run noop",
            "r set speed 1.5; run noop",
            "r seek 10;subprocess noop",
            "r set input-commands 'run noop'",
            "r set options/input-commands 'run noop'",
            "r cycle-values options/input-conf unchecked.conf other.conf",
            "r set options/o NUL",
            "r set vo lavc",
            "r set vf 'lavfi=movie=other'",
            "r apply-profile other",
            "r define-section other 'r run noop'",
            "r script-binding other",
            "r loadfile other.mkv",
            "r screenshot",
            "r quit-watch-later",
            "r show-text \\\"x\\\"; run noop",
            "r show-text `custom quoted text`",
            "r show-text 'unterminated",
        ] {
            assert!(!input_line(line), "{line:?}");
        }
        let directory = std::env::temp_dir().join(format!("miry-input-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&directory).unwrap();
        let file = directory.join("input.conf");
        std::fs::write(&file, "r run\tnoop\n").unwrap();
        let q = Quality {
            directory: Some(directory.clone()),
            input_config: true,
            ..Default::default()
        };
        assert!(q.arguments().is_err());
        std::fs::remove_file(file).unwrap();
        std::fs::remove_dir(directory).unwrap();
    }
    #[test]
    fn input_commands_preserve_ordinary_keys_and_quoted_text() {
        for line in [
            "# example",
            "",
            "SPACE cycle mute",
            "z set speed 1.5",
            "r\tset\tsub-pos\t90",
            "r no-osd seek 10 relative+exact",
            "r set volume 40; cycle pause",
            "r show-text 'literal run noop; screenshot'",
            "r show-text \"set input-commands is literal text\"",
            "r show-text \"\"",
            "r {default} cycle-values sub-visibility yes no",
            "r frame-step",
        ] {
            assert!(input_line(line), "{line:?}");
        }
    }
    #[test]
    fn requested_bitstream_is_explicit_and_sdr_policy_is_bounded() {
        let q = Quality {
            hdr: "sdr".into(),
            passthrough: "on".into(),
            codecs: vec!["truehd".into()],
            ..Default::default()
        };
        let a = q.arguments().unwrap();
        assert!(a.contains(&"--audio-spdif=truehd".into()));
        assert!(a.contains(&"--target-trc=srgb".into()));
    }
    #[test]
    fn shader_names_cannot_escape_local_directory() {
        assert!(!shader_name("../shader.glsl"));
        assert!(!shader_name("C:\\shader.glsl"));
        assert!(shader_name("my shader.glsl"));
    }
}
