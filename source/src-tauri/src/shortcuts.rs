use std::collections::{HashMap, HashSet};
pub fn defaults() -> HashMap<String, String> {
    [
        ("pause", "Space"),
        ("backward", "ArrowLeft"),
        ("forward", "ArrowRight"),
        ("fullscreen", "KeyF"),
        ("mute", "KeyM"),
        ("subtitle", "KeyS"),
        ("audio", "KeyA"),
        ("next", "KeyN"),
        ("previous", "KeyP"),
    ]
    .into_iter()
    .map(|(a, k)| (a.into(), k.into()))
    .collect()
}
pub fn mpv_key(code: &str) -> Option<String> {
    if matches!(code, "KeyH" | "Alt+F4" | "Ctrl+Alt+Delete") {
        return None;
    }
    let mut parts: Vec<&str> = code.split('+').collect();
    let key = parts.pop()?;
    let mut last = 0;
    for part in &parts {
        let rank = match *part {
            "Ctrl" => 1,
            "Alt" => 2,
            "Shift" => 3,
            _ => return None,
        };
        if rank <= last {
            return None;
        }
        last = rank;
    }
    let base = match key {
        "Space" => Some("SPACE".into()),
        "ArrowLeft" => Some("LEFT".into()),
        "ArrowRight" => Some("RIGHT".into()),
        "ArrowUp" => Some("UP".into()),
        "ArrowDown" => Some("DOWN".into()),
        "Enter" => Some("ENTER".into()),
        "Tab" => Some("TAB".into()),
        "Escape" => Some("ESC".into()),
        "Backspace" => Some("BS".into()),
        "Delete" => Some("DEL".into()),
        "Home" => Some("HOME".into()),
        "End" => Some("END".into()),
        "PageUp" => Some("PGUP".into()),
        "PageDown" => Some("PGDWN".into()),
        _ => {
            if key.len() == 4 && key.starts_with("Key") && key.as_bytes()[3].is_ascii_uppercase() {
                Some(key[3..].to_ascii_lowercase())
            } else if key.len() == 6
                && key.starts_with("Digit")
                && key.as_bytes()[5].is_ascii_digit()
            {
                Some(key[5..].into())
            } else if key
                .strip_prefix('F')
                .and_then(|n| n.parse::<u8>().ok())
                .is_some_and(|n| (1..=12).contains(&n))
            {
                Some(key.into())
            } else {
                None
            }
        }
    }?;
    parts.push(&base);
    Some(parts.join("+"))
}
pub fn validate(bindings: &HashMap<String, String>) -> Result<(), String> {
    let allowed = defaults();
    let mut used = HashSet::new();
    if bindings.len() != allowed.len()
        || bindings.iter().any(|(a, k)| {
            !allowed.contains_key(a) || (!k.is_empty() && (mpv_key(k).is_none() || !used.insert(k)))
        })
    {
        return Err("快捷键绑定无效或重复。".into());
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_duplicate_or_command_injection() {
        let mut k = defaults();
        k.insert("pause".into(), "KeyF".into());
        assert!(validate(&k).is_err());
        assert!(mpv_key("SPACE cycle pause").is_none());
        assert_eq!(mpv_key("KeyM"), Some("m".into()));
    }
    #[test]
    fn accepts_canonical_chords_and_rejects_system_reserved_or_aliases() {
        for (code, expected) in [
            ("Ctrl+KeyK", "Ctrl+k"),
            ("Ctrl+Shift+KeyS", "Ctrl+Shift+s"),
            ("Alt+Enter", "Alt+ENTER"),
            ("Shift+ArrowLeft", "Shift+LEFT"),
            ("Ctrl+Alt+KeyP", "Ctrl+Alt+p"),
        ] {
            assert_eq!(mpv_key(code).as_deref(), Some(expected));
            let mut bindings = defaults();
            bindings.insert("pause".into(), code.into());
            assert!(validate(&bindings).is_ok());
        }
        for code in [
            "Alt+F4",
            "Ctrl+Alt+Delete",
            "Meta+KeyK",
            "Shift+Ctrl+KeyS",
            "Ctrl+Ctrl+KeyK",
        ] {
            assert!(mpv_key(code).is_none());
        }
    }
}
