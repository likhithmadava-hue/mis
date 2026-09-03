//! What is actually on screen right now, straight from Win32.
//!
//! Three questions, nine functions:
//!
//! ```text
//!   which window has focus    GetForegroundWindow
//!   what program is that      GetWindowThreadProcessId → OpenProcess →
//!                             QueryFullProcessImageNameW
//!   is anyone actually here   GetLastInputInfo, against GetTickCount
//! ```
//!
//! The last one carries the most weight. Without it, a paused film left on
//! screen for two hours reads as two hours of "usage" and every number the tab
//! shows becomes a fiction. Idle time is **measured, not guessed**, and it is
//! excluded.
//!
//! What this cannot see, stated plainly so nothing downstream over-claims:
//!
//!   - **Which browser tab is in front.** Windows reports one process,
//!     `msedge.exe`. The window title often names the page, which is why titles
//!     are captured, but there is no tab-level API here.
//!   - **Anything on a phone or another PC.** One Windows account, one machine.
//!   - **Windows of other users' sessions, or elevated processes we cannot
//!     open.** Those come back as `UNKNOWN_APP` rather than being dropped, so
//!     the time is still counted honestly even when the name is not available.

/// Stand-in when a process refuses to be named — elevated, protected, or exited
/// between the two calls. The time is real; only the label is missing.
pub const UNKNOWN_APP: &str = "unknown";

/// Stand-in when nothing at all holds focus: the desktop, the lock screen, or
/// the moment between one window closing and the next taking over.
pub const NO_WINDOW_APP: &str = "desktop";

/// How long without a keystroke or mouse move before the screen stops counting.
///
/// Sixty seconds is long enough to read a paragraph or watch a worked solution
/// without being marked away, and short enough that walking off is not billed as
/// study time.
pub const IDLE_AFTER: f64 = 60.0;

/// One look at the screen.
#[derive(Debug, Clone, PartialEq)]
pub struct Snapshot {
    /// The executable's bare name, lowercased (`msedge.exe`) — the key
    /// everything else groups by.
    pub app: String,
    /// The window caption, which for a browser is usually the page.
    pub title: String,
    /// How long the keyboard and mouse have been untouched.
    pub idle_seconds: f64,
}

impl Snapshot {
    /// Whether a person appears to be at the keyboard.
    pub fn present(&self) -> bool {
        self.idle_seconds < IDLE_AFTER
    }
}

#[cfg(windows)]
mod sys {
    use std::ffi::c_void;

    pub type Hwnd = *mut c_void;
    pub type Handle = *mut c_void;

    /// The least privilege that still allows `QueryFullProcessImageNameW`.
    /// Asking for `PROCESS_QUERY_INFORMATION` instead would fail on protected
    /// processes that this lighter right can still name.
    pub const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

    #[repr(C)]
    pub struct LastInputInfo {
        pub cb_size: u32,
        pub dw_time: u32,
    }

    #[link(name = "user32")]
    extern "system" {
        pub fn GetForegroundWindow() -> Hwnd;
        pub fn GetWindowTextLengthW(hwnd: Hwnd) -> i32;
        pub fn GetWindowTextW(hwnd: Hwnd, buf: *mut u16, max: i32) -> i32;
        pub fn GetWindowThreadProcessId(hwnd: Hwnd, pid: *mut u32) -> u32;
        pub fn GetLastInputInfo(info: *mut LastInputInfo) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        pub fn OpenProcess(access: u32, inherit: i32, pid: u32) -> Handle;
        pub fn CloseHandle(h: Handle) -> i32;
        pub fn QueryFullProcessImageNameW(h: Handle, flags: u32, buf: *mut u16, size: *mut u32) -> i32;
        pub fn GetTickCount() -> u32;
    }
}

#[cfg(windows)]
fn window_title(hwnd: sys::Hwnd) -> String {
    unsafe {
        let len = sys::GetWindowTextLengthW(hwnd);
        if len <= 0 {
            return String::new();
        }
        let mut buf = vec![0u16; len as usize + 1];
        let written = sys::GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if written <= 0 {
            return String::new();
        }
        String::from_utf16_lossy(&buf[..written as usize])
    }
}

#[cfg(windows)]
fn process_name(hwnd: sys::Hwnd) -> String {
    unsafe {
        let mut pid: u32 = 0;
        sys::GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return UNKNOWN_APP.into();
        }

        let handle = sys::OpenProcess(sys::PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            // Elevated or protected process — we may not open it, and that is
            // fine. The time still counts; only the name is unavailable.
            return UNKNOWN_APP.into();
        }

        let mut size: u32 = 32768;
        let mut buf = vec![0u16; size as usize];
        let ok = sys::QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut size);
        sys::CloseHandle(handle);

        if ok == 0 {
            return UNKNOWN_APP.into();
        }
        let full = String::from_utf16_lossy(&buf[..size as usize]);
        full.rsplit('\\').next().unwrap_or(UNKNOWN_APP).to_lowercase()
    }
}

/// Seconds since the last keyboard or mouse input, system-wide.
#[cfg(windows)]
pub fn idle_seconds() -> f64 {
    unsafe {
        let mut info = sys::LastInputInfo {
            cb_size: std::mem::size_of::<sys::LastInputInfo>() as u32,
            dw_time: 0,
        };
        if sys::GetLastInputInfo(&mut info) == 0 {
            // If Windows will not say, assume someone is there. Over-counting a
            // rare failure is better than silently dropping real usage.
            return 0.0;
        }
        // Both values are 32-bit millisecond tick counts that wrap every ~49
        // days. `wrapping_sub` makes the subtraction wrap the same way, so the
        // rollover produces a correct small difference rather than a 49-day one.
        let delta = sys::GetTickCount().wrapping_sub(info.dw_time);
        f64::from(delta) / 1000.0
    }
}

/// The foreground app, its window title, and how long the user has been idle.
#[cfg(windows)]
pub fn snapshot() -> Snapshot {
    let idle = idle_seconds();
    let hwnd = unsafe { sys::GetForegroundWindow() };
    if hwnd.is_null() {
        return Snapshot { app: NO_WINDOW_APP.into(), title: String::new(), idle_seconds: idle };
    }
    Snapshot { app: process_name(hwnd), title: window_title(hwnd), idle_seconds: idle }
}

// ── Non-Windows ─────────────────────────────────────────────────────────────
// So the crate still builds and tests elsewhere. Reporting permanent idleness
// means the tracker records nothing rather than inventing plausible rows.

#[cfg(not(windows))]
pub fn idle_seconds() -> f64 {
    f64::INFINITY
}

#[cfg(not(windows))]
pub fn snapshot() -> Snapshot {
    Snapshot {
        app: NO_WINDOW_APP.into(),
        title: String::new(),
        idle_seconds: f64::INFINITY,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn idleness_decides_presence() {
        let here = Snapshot { app: "code.exe".into(), title: "x".into(), idle_seconds: 5.0 };
        let away = Snapshot { app: "code.exe".into(), title: "x".into(), idle_seconds: IDLE_AFTER + 1.0 };
        assert!(here.present());
        assert!(!away.present(), "a paused film must not read as usage");
    }

    #[cfg(windows)]
    #[test]
    fn a_snapshot_names_something_and_reports_finite_idleness() {
        let s = snapshot();
        assert!(!s.app.is_empty());
        assert!(s.idle_seconds.is_finite() && s.idle_seconds >= 0.0);
    }
}
