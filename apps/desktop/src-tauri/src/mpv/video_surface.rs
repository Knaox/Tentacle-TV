/// Native child window used as mpv's rendering target on Windows.
/// This window sits behind the WebView2 control in z-order so
/// that transparent areas of the web UI reveal the video beneath.
#[cfg(target_os = "windows")]
pub mod win32 {
    use std::sync::Once;
    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::*;
    use windows::Win32::Graphics::Gdi::*;
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::WindowsAndMessaging::*;

    static REGISTER: Once = Once::new();
    const CLASS: PCWSTR = w!("TentacleMpvSurface");

    unsafe extern "system" fn wnd_proc(
        hwnd: HWND,
        msg: u32,
        wp: WPARAM,
        lp: LPARAM,
    ) -> LRESULT {
        DefWindowProcW(hwnd, msg, wp, lp)
    }

    /// Create a child window filling `parent` for mpv to render into.
    /// Returns the child HWND as a raw `isize`.
    pub fn create(parent: isize) -> Result<isize, String> {
        unsafe {
            let hmodule = GetModuleHandleW(None)
                .map_err(|e| format!("GetModuleHandle: {e}"))?;
            let hinstance: HINSTANCE = std::mem::transmute(hmodule);

            REGISTER.call_once(|| {
                let wc = WNDCLASSEXW {
                    cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
                    lpfnWndProc: Some(wnd_proc),
                    hInstance: hinstance,
                    lpszClassName: CLASS,
                    hbrBackground: HBRUSH(GetStockObject(BLACK_BRUSH).0),
                    ..Default::default()
                };
                RegisterClassExW(&wc);
            });

            let parent_hwnd = HWND(parent as *mut _);
            let mut rc = RECT::default();
            let _ = GetClientRect(parent_hwnd, &mut rc);

            let child = CreateWindowExW(
                WINDOW_EX_STYLE(0),
                CLASS,
                w!("mpv"),
                WS_CHILD | WS_VISIBLE,
                0,
                0,
                rc.right,
                rc.bottom,
                Some(parent_hwnd),
                None,
                Some(hinstance),
                None,
            )
            .map_err(|e| format!("CreateWindowExW: {e}"))?;

            // Place behind all siblings so WebView2 stays on top
            let _ = SetWindowPos(
                child,
                Some(HWND_BOTTOM),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );

            Ok(child.0 as isize)
        }
    }

    /// Resize the child window (called when the Tauri window resizes).
    pub fn resize(hwnd: isize, w: i32, h: i32) {
        unsafe {
            let _ = MoveWindow(HWND(hwnd as *mut _), 0, 0, w, h, true);
        }
    }

    /// Destroy the child window.
    pub fn destroy(hwnd: isize) {
        unsafe {
            let _ = DestroyWindow(HWND(hwnd as *mut _));
        }
    }
}
