//! MIS — Mistake Intelligence System.
//!
//! A Windows study app: a Solid frontend in a Tauri window, over a Rust backend
//! that owns an encrypted, tamper-evident vault on the device.
//!
//! ```text
//!   Solid UI  ──invoke()──►  commands.rs
//!                              │
//!                            state.rs        one mutex over both
//!                              ├── db/       shapes, seed, migrations, rules
//!                              ├── scoring   what a score means
//!                              ├── vault/    AES-256-GCM + DPAPI + audit chain
//!                              └── screentime/  the foreground-window tracker
//! ```
//!
//! Nothing here talks to the network, and there is no server. The Python host
//! that used to serve the app over loopback is gone, along with its port, its
//! per-launch token, and the dormant Supabase sync that was left switched off in
//! the old codebase. If accounts come back one day they will be a new decision,
//! not a commented-out block waiting to be uncommented.

pub mod commands;
pub mod dates;
pub mod db;
pub mod error;
pub mod scoring;
pub mod screentime;
pub mod state;
pub mod vault;

use state::AppState;
use tauri::{Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // The vault is opened before the window is built. If it cannot be opened —
    // a vault sealed by another Windows account, a damaged file — the user gets
    // a dialog that says so rather than an empty app that quietly starts a
    // second, separate history.
    let state = match AppState::boot() {
        Ok(s) => s,
        Err(e) => {
            fatal(&format!(
                "MIS could not open your data.\n\n{e}\n\nYour vault is at:\n{}\n\nNothing has \
                 been changed or deleted. If you have moved to a new Windows account or a new \
                 computer, the vault needs to be recovered rather than opened.",
                vault::vault_dir().display()
            ));
            return;
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(state)
        .setup(|app| {
            // Recording starts with the window and stops with it. Nothing is
            // registered at Windows startup and no service is installed.
            app.state::<AppState>().tracker.start();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // database
            commands::db_load,
            commands::db_today_metric,
            commands::db_today_is_locked,
            commands::db_update_today,
            commands::db_save_user,
            commands::db_lock_today,
            commands::db_unlock_today,
            commands::db_day_is_intact,
            // mark logbook
            commands::db_add_mark_entry,
            commands::db_add_mark_entries,
            commands::db_update_mark_entry,
            commands::db_delete_mark_entry,
            commands::db_replace_mark_logbook,
            commands::db_logbook_fingerprints,
            // focus
            commands::db_add_focus_session,
            commands::db_add_study_minutes,
            commands::db_save_focus_settings,
            // tasks
            commands::db_add_task,
            commands::db_toggle_task,
            commands::db_delete_task,
            // topics
            commands::db_add_topic,
            commands::db_toggle_topic,
            commands::db_delete_topic,
            // habits
            commands::db_add_habit,
            commands::db_set_habit_priority,
            commands::db_delete_habit,
            commands::db_habits_done_on,
            commands::db_toggle_habit_today,
            // tracks and mode
            commands::db_set_track_priority,
            commands::db_set_app_mode,
            commands::db_reset,
            // scoring
            commands::score_range,
            commands::study_streak,
            // vault
            commands::vault_info,
            commands::audit_recent,
            commands::db_export_json,
            commands::app_version,
            // screen time
            commands::st_status,
            commands::st_availability,
            commands::st_day,
            commands::st_range,
            commands::st_set_paused,
            commands::st_categories,
            commands::st_set_category,
            commands::st_clear_category,
            commands::st_recorded_days,
            commands::st_forget,
            commands::st_settings,
        ])
        .build(tauri::generate_context!())
        .expect("MIS failed to start")
        .run(|app, event| {
            // Flush the day's screen time on the way out. Without this the last
            // FLUSH_SECONDS of every session would be lost on a clean exit,
            // which is the one case where losing it is inexcusable.
            if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
                app.state::<AppState>().tracker.stop();
            }
        });
}

/// Report a startup failure to the user. There is no window yet and no console
/// in a released build, so this goes to the Win32 message box directly.
fn fatal(message: &str) {
    eprintln!("[mis] {message}");

    #[cfg(windows)]
    unsafe {
        const MB_ICONERROR: u32 = 0x10;

        #[link(name = "user32")]
        extern "system" {
            fn MessageBoxW(hwnd: *mut std::ffi::c_void, text: *const u16, caption: *const u16, kind: u32) -> i32;
        }

        let wide = |s: &str| s.encode_utf16().chain(std::iter::once(0)).collect::<Vec<u16>>();
        MessageBoxW(
            std::ptr::null_mut(),
            wide(message).as_ptr(),
            wide("MIS").as_ptr(),
            MB_ICONERROR,
        );
    }
}
