//! Video fitting stays inside mpv; it never changes the native surface rectangle.
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{json, Value};

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum VideoFit {
    #[default]
    Fit,
    Fill,
    Stretch,
}

pub fn deserialize_preference<'de, D: Deserializer<'de>>(d: D) -> Result<VideoFit, D::Error> {
    let value = Value::deserialize(d)?;
    Ok(serde_json::from_value(value).unwrap_or_default())
}

impl VideoFit {
    pub fn properties(self) -> Vec<(&'static str, Value)> {
        vec![
            // Explicit modes take precedence over advanced manual geometry options.
            // -2 is this bundled mpv's default "no override": retain source DAR/SAR.
            ("video-aspect-override", json!(-2)),
            ("video-unscaled", json!(false)),
            ("video-zoom", json!(0)),
            ("video-pan-x", json!(0)),
            ("video-pan-y", json!(0)),
            ("keepaspect", json!(self != Self::Stretch)),
            ("panscan", json!(if self == Self::Fill { 1 } else { 0 })),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_and_invalid_preferences_fall_back_without_rejecting_launch() {
        #[derive(Deserialize)]
        struct Preference {
            #[serde(default, deserialize_with = "deserialize_preference")]
            mode: VideoFit,
        }
        assert_eq!(
            serde_json::from_str::<Preference>("{}").unwrap().mode,
            VideoFit::Fit
        );
        for value in [
            json!(null),
            json!(12),
            json!({}),
            json!([]),
            json!("unknown"),
        ] {
            let p: Preference = serde_json::from_value(json!({"mode": value})).unwrap();
            assert_eq!(p.mode, VideoFit::Fit);
        }
        for mode in [VideoFit::Fit, VideoFit::Fill, VideoFit::Stretch] {
            let p: Preference = serde_json::from_value(json!({"mode": mode})).unwrap();
            assert_eq!(p.mode, mode);
        }
        // Live IPC input is strict; malformed requests must not silently change mode.
        assert!(serde_json::from_value::<VideoFit>(json!("unknown")).is_err());
    }
}
