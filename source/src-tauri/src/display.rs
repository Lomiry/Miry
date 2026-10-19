use serde::Serialize;
#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayColor {
    pub hdr: Option<bool>,
    pub advanced_color: Option<bool>,
}
// Read-only CCD APIs; no desktop HDR setting is changed. Cloned/ambiguous targets stay Unknown.
pub fn window_color(window: &tauri::WebviewWindow) -> DisplayColor {
    #[cfg(windows)]
    if let Ok(hwnd) = window.hwnd() {
        return color_for_window(hwnd.0 as _).unwrap_or_default();
    }
    DisplayColor::default()
}
#[cfg(windows)]
fn color_for_window(hwnd: windows_sys::Win32::Foundation::HWND) -> Option<DisplayColor> {
    use std::{mem::size_of, ptr::null_mut};
    use windows_sys::Win32::{Devices::Display::*, Graphics::Gdi::*};
    // SDK 10.0.26100 wingdi.h: official INFO_2 ABI, not yet emitted by windows-sys.
    #[repr(C)]
    #[derive(Default)]
    struct Info2 {
        header: DISPLAYCONFIG_DEVICE_INFO_HEADER,
        flags: u32,
        encoding: i32,
        bits: u32,
        mode: i32,
    }
    unsafe {
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFOEXW::default();
        info.monitorInfo.cbSize = size_of::<MONITORINFOEXW>() as u32;
        if GetMonitorInfoW(monitor, &mut info as *mut _ as _) == 0 {
            return None;
        }
        for _ in 0..3 {
            let (mut pc, mut mc) = (0, 0);
            if GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut pc, &mut mc) != 0
                || pc > 256
                || mc > 1024
            {
                return None;
            }
            let mut paths = vec![DISPLAYCONFIG_PATH_INFO::default(); pc as usize];
            let mut modes = vec![DISPLAYCONFIG_MODE_INFO::default(); mc as usize];
            let result = QueryDisplayConfig(
                QDC_ONLY_ACTIVE_PATHS,
                &mut pc,
                paths.as_mut_ptr(),
                &mut mc,
                modes.as_mut_ptr(),
                null_mut(),
            );
            if result == 122 {
                continue;
            }
            if result != 0 {
                return None;
            }
            let mut matches = vec![];
            for p in paths.into_iter().take(pc as usize) {
                let mut source = DISPLAYCONFIG_SOURCE_DEVICE_NAME {
                    header: DISPLAYCONFIG_DEVICE_INFO_HEADER {
                        r#type: DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME,
                        size: size_of::<DISPLAYCONFIG_SOURCE_DEVICE_NAME>() as u32,
                        adapterId: p.sourceInfo.adapterId,
                        id: p.sourceInfo.id,
                    },
                    ..Default::default()
                };
                if DisplayConfigGetDeviceInfo(&mut source.header) != 0
                    || source.viewGdiDeviceName != info.szDevice
                {
                    continue;
                }
                let header = DISPLAYCONFIG_DEVICE_INFO_HEADER {
                    r#type: 15,
                    size: size_of::<Info2>() as u32,
                    adapterId: p.targetInfo.adapterId,
                    id: p.targetInfo.id,
                };
                let mut color = Info2 {
                    header,
                    ..Default::default()
                };
                if DisplayConfigGetDeviceInfo(&mut color.header) == 0 {
                    matches.push(DisplayColor {
                        hdr: Some(color.mode == 2),
                        advanced_color: Some(color.flags & 2 != 0),
                    });
                } else {
                    let mut legacy = DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO {
                        header: DISPLAYCONFIG_DEVICE_INFO_HEADER {
                            r#type: DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO,
                            size: size_of::<DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO>() as u32,
                            adapterId: p.targetInfo.adapterId,
                            id: p.targetInfo.id,
                        },
                        ..Default::default()
                    };
                    if DisplayConfigGetDeviceInfo(&mut legacy.header) == 0 {
                        let enabled = legacy.Anonymous.value & 2 != 0;
                        matches.push(DisplayColor {
                            hdr: if enabled { None } else { Some(false) },
                            advanced_color: Some(enabled),
                        });
                    }
                }
            }
            return if matches.len() == 1 {
                matches.pop()
            } else {
                None
            };
        }
    }
    None
}
