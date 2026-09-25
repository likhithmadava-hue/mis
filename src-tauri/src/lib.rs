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
//! the old codebase.
//!
//! There *is* an account now, but it is local: a username, an email kept on the
//! profile, and a password that wraps the vault key (`vault/passkey.rs`).
//! Nothing is sent anywhere, which is also why a forgotten password is recovered
//! with a code shown at sign-up and not an email — there is no server to send one.

pub mod commands;
pub mod content;
pub mod dates;
pub mod db;
pub mod error;
pub mod scoring;
pub mod screentime;
pub mod state;
pub mod vault;

use screentime::autostart::{self, BACKGROUND_FLAG};
use state::AppState;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, WebviewWindowBuilder};

const MAIN_WINDOW: &str = "main";
const TRAY_ID: &str = "mis-tray";

/// Bring the window to the front, building it again if it was closed.
///
/// With background tracking on, closing the window destroys it (freeing the
/// web view) while the process lives on, so "open" has to be able to make a new
/// one from the same config the first came from.
pub(crate) fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }
    let Some(config) = app.config().app.windows.iter().find(|w| w.label == MAIN_WINDOW) else {
        return;
    };
    if let Ok(builder) = WebviewWindowBuilder::from_config(app, config) {
        let _ = builder.build();
    }
}

/// Show (or hide) the notification-area icon that says MIS is recording.
///
/// The icon is what keeps background tracking honest: it is there whenever the
/// process could be recording with no window, and its menu is the way to stop it.
pub(crate) fn sync_tray(app: &AppHandle, on: bool) {
    if !on {
        let _ = app.remove_tray_by_id(TRAY_ID);
        return;
    }
    if app.tray_by_id(TRAY_ID).is_some() {
        return;
    }
    let build = || -> tauri::Result<()> {
        let open = MenuItem::with_id(app, "open", "Open MIS", true, None::<&str>)?;
        let quit =
            MenuItem::with_id(app, "quit", "Quit MIS (stops recording)", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&open, &quit])?;

        let mut tray = TrayIconBuilder::with_id(TRAY_ID)
            .tooltip("MIS is recording screen time")
            .menu(&menu)
            .show_menu_on_left_click(false)
            .on_menu_event(|app, event| match event.id().as_ref() {
                "open" => show_main(app),
                "quit" => app.exit(0),
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    show_main(tray.app_handle());
                }
            });
        if let Some(icon) = app.default_window_icon() {
            tray = tray.icon(icon.clone());
        }
        tray.build(app)?;
        Ok(())
    };
    if let Err(e) = build() {
        eprintln!("[mis] could not create the tray icon: {e}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Registered first. A second copy - MIS opened from the Start menu while
        // the login entry already has one recording in the tray - hands over to
        // the first and exits, so two trackers never count the same minute twice.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if !args.iter().any(|a| a == BACKGROUND_FLAG) {
                show_main(app);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // The vault is opened before any window is built. If it cannot be
            // opened - a vault sealed by another Windows account, a damaged file
            // - the user gets a dialog that says so rather than an empty app that
            // quietly starts a second, separate history. It happens here rather
            // than before the builder so that a second copy of MIS has already
            // been turned away by the single-instance check and never touches the
            // vault at all.
            let state = match AppState::boot() {
                Ok(s) => s,
                Err(e) => {
                    fatal(&format!(
                        "MIS could not open your data.\n\n{e}\n\nYour vault is at:\n{}\n\nNothing \
                         has been changed or deleted. If you have moved to a new Windows account or \
                         a new computer, the vault needs to be recovered rather than opened.",
                        vault::vault_dir().display()
                    ));
                    std::process::exit(1);
                }
            };

            let background = state.tracker.background();
            let launched_in_background = std::env::args().any(|a| a == BACKGROUND_FLAG);

            // A login entry left behind after the feature was switched off (or
            // the vault reset) must not resurrect an invisible tracker.
            if launched_in_background && !background {
                let _ = autostart::set(false);
                std::process::exit(0);
            }

            state.tracker.start();
            app.manage(state);

            if background {
                // Heals the entry if MIS was moved or reinstalled since it was
                // written, and shows the tray icon before anything else can.
                let _ = autostart::set(true);
                sync_tray(app.handle(), true);
            }
            if !launched_in_background {
                show_main(app.handle());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // account and lock
            commands::auth_status,
            commands::auth_setup,
            commands::auth_login,
            commands::auth_lock,
            commands::auth_recover,
            commands::auth_change_password,
            commands::auth_new_recovery_code,
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
            commands::db_add_dpp,
            commands::db_toggle_dpp,
            commands::db_delete_dpp,
            commands::db_toggle_task,
            commands::db_delete_task,
            // topics
            commands::db_add_topic,
            commands::db_toggle_topic,
            commands::db_delete_topic,
            // session wrap-up and the journal
            commands::db_session_wrap,
            commands::db_update_journal_note,
            commands::db_delete_journal_entry,
            // built-in study content
            commands::content_syllabus,
            commands::content_bank_chapters,
            commands::content_questions,
            // habits
            commands::db_add_habit,
            commands::db_set_habit_priority,
            commands::db_delete_habit,
            commands::db_habits_done_on,
            commands::db_toggle_habit_today,
            // tracks and mode
            commands::db_set_track_priority,
            commands::db_set_app_mode,
            commands::db_set_daily_log_layout,
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
            commands::st_set_background,
            commands::st_categories,
            commands::st_set_category,
            commands::st_clear_category,
            commands::st_recorded_days,
            commands::st_forget,
            commands::st_settings,
        ])
        .build(tauri::generate_context!())
        .expect("MIS failed to start")
        .run(|app, event| match event {
            // The last window closing is the one exit MIS can decline: with
            // background tracking on, the process stays in the tray and keeps
            // recording. An explicit quit (tray menu, `app.exit`) carries an exit
            // code and always goes through.
            RunEvent::ExitRequested { api, code, .. } => {
                let keep_recording = code.is_none()
                    && app
                        .try_state::<AppState>()
                        .map(|s| s.tracker.background())
                        .unwrap_or(false);
                if keep_recording {
                    api.prevent_exit();
                }
            }
            // Flush the day's screen time on the way out. Without this the last
            // FLUSH_SECONDS of every session would be lost on a clean exit, which
            // is the one case where losing it is inexcusable.
            RunEvent::Exit => {
                if let Some(state) = app.try_state::<AppState>() {
                    state.tracker.stop();
                }
            }
            _ => {}
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
