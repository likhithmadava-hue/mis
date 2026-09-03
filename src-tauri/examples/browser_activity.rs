//! One-off, read-only dump of recorded window titles, per app, per day.
//!
//! The first version of this hard-coded a list of known browser executables
//! (chrome.exe, msedge.exe, ...) and filtered for those — which silently
//! missed anything not on the list (e.g. `ulaa.exe`). Guessing which exe is a
//! browser is exactly the mistake `categories.rs` warns against: "a misfiled
//! app is worse than an unfiled one."
//!
//! This version does no guessing. It calls the same `summary::by_app` the
//! real Screen Time tab renders from — the same grouping, the same top-8
//! titles per app, ranked the same way — for every recorded day, and prints
//! every app. Windows only exposes a foreground window's title, not a URL, so
//! "website" here still means "what the title bar said," but at least nothing
//! is dropped by a stale allowlist.
//!
//! Run with: cargo run --example browser_activity --manifest-path src-tauri/Cargo.toml

use mis_lib::screentime::store::Store;
use mis_lib::screentime::summary;
use mis_lib::vault::vault_dir;

fn main() {
    let dir = vault_dir().join("screentime");
    let store = Store::new(dir);
    let settings = store.load_settings();
    let days = store.recorded_days();

    if days.is_empty() {
        println!("No screen time recorded yet.");
        return;
    }

    for day in days {
        let intervals = store.load_day(&day);
        let rows = summary::by_app(&intervals, &settings);
        if rows.is_empty() {
            continue;
        }

        println!("\n{day}");
        for row in rows {
            let mins = row.seconds / 60;
            println!("  {:>4}m  {:<18} [{}]", mins, row.app, row.category);
            for t in &row.titles {
                let title = if t.title.trim().is_empty() { "(no title)" } else { t.title.trim() };
                println!("        {:>4}s  {}", t.seconds, title);
            }
        }
    }
}
