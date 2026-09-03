//! Patches a saved database forward to the current shape.
//!
//! **This runs on raw JSON, before the typed structs ever see it, and that is
//! deliberate.** The old TS `migrate()` could mutate an already-parsed object
//! because TypeScript's types evaporate at runtime. Rust's do not: an old vault
//! containing `"mistake_reason": "Silly Mistake"` would fail to deserialise into
//! `MistakeReason` and the whole load would error out before any migration
//! could fix it. So the value-remapping steps have to happen here, on
//! `serde_json::Value`.
//!
//! Missing *fields* are handled by `#[serde(default)]` on the structs. What is
//! left for this file is the work defaults cannot do: renamed values and fields
//! whose meaning was split.
//!
//! Returns whether anything actually changed, so the vault is only rewritten
//! when it was.

use serde_json::{Map, Value};

pub fn migrate(db: &mut Value) -> bool {
    let Some(root) = db.as_object_mut() else {
        return false;
    };
    let mut migrated = false;

    migrated |= ensure_array(root, "topics");
    migrated |= ensure_array(root, "habit_log");
    migrated |= ensure_array(root, "daily_metrics");
    migrated |= ensure_array(root, "mark_logbook");
    migrated |= ensure_array(root, "focus_sessions");
    migrated |= ensure_array(root, "tasks");

    // Data saved before the app had modes opens in Academic.
    if !root.contains_key("app_mode") {
        root.insert("app_mode".into(), Value::String("academic".into()));
        migrated = true;
    }

    // Settings saved before the flip-clock option existed.
    if let Some(fs) = root.get_mut("focus_settings").and_then(Value::as_object_mut) {
        if !fs.contains_key("timer_design") {
            fs.insert("timer_design".into(), Value::String("ring".into()));
            migrated = true;
        }
        // Settings saved before the focus-music player existed.
        if !fs.contains_key("focus_music") {
            fs.insert("focus_music".into(), Value::String("off".into()));
            migrated = true;
        }
        if !fs.contains_key("music_volume") {
            fs.insert("music_volume".into(), serde_json::json!(0.5));
            migrated = true;
        }
        // Settings saved before ambient noise and brainwave tones existed.
        if !fs.contains_key("ambient_sound") {
            fs.insert("ambient_sound".into(), Value::String("off".into()));
            migrated = true;
        }
        if !fs.contains_key("ambient_volume") {
            fs.insert("ambient_volume".into(), serde_json::json!(0.5));
            migrated = true;
        }
        if !fs.contains_key("brainwave") {
            fs.insert("brainwave".into(), Value::String("off".into()));
            migrated = true;
        }
        if !fs.contains_key("brainwave_volume") {
            fs.insert("brainwave_volume".into(), serde_json::json!(0.5));
            migrated = true;
        }
    }

    // The sleep window used to live in Wellness component state and was never
    // saved at all.
    if let Some(user) = root.get_mut("user").and_then(Value::as_object_mut) {
        if !user.contains_key("sleep_bedtime") {
            user.insert("sleep_bedtime".into(), Value::String("22:30".into()));
            user.insert("sleep_wake".into(), Value::String("06:30".into()));
            migrated = true;
        }
    }

    migrated |= migrate_mark_logbook(root);
    migrated
}

fn ensure_array(root: &mut Map<String, Value>, key: &str) -> bool {
    if !root.get(key).map(Value::is_array).unwrap_or(false) {
        root.insert(key.into(), Value::Array(vec![]));
        return true;
    }
    false
}

/// The mark logbook gained `chapter` / `difficulty` / `time_spent`, and the
/// three original mistake reasons became the nine MIS ones.
fn migrate_mark_logbook(root: &mut Map<String, Value>) -> bool {
    let Some(entries) = root.get_mut("mark_logbook").and_then(Value::as_array_mut) else {
        return false;
    };
    let mut migrated = false;

    for entry in entries {
        let Some(e) = entry.as_object_mut() else { continue };

        // Subjects used to be stored as one string, `"Physics - Kinematics"`.
        // The absence of `chapter` is what marks a row as pre-split.
        if !e.contains_key("chapter") {
            let raw = e.get("subject").and_then(Value::as_str).unwrap_or("").to_string();
            let (subject, chapter) = match raw.split_once(" - ") {
                Some((s, rest)) => (s.trim().to_string(), rest.trim().to_string()),
                None => (raw.trim().to_string(), String::new()),
            };
            e.insert("subject".into(), Value::String(subject));
            e.insert("chapter".into(), Value::String(chapter));
            migrated = true;
        }

        if !e.contains_key("difficulty") {
            e.insert("difficulty".into(), Value::String("Medium".into()));
            migrated = true;
        }
        if !e.contains_key("time_spent") {
            e.insert("time_spent".into(), Value::Number(0.into()));
            migrated = true;
        }

        // The value remap that forced this whole file to run on raw JSON.
        if let Some(reason) = e.get("mistake_reason").and_then(Value::as_str) {
            let remapped = match reason {
                "Conceptual Error" => Some("Conceptual"),
                "Silly Mistake" => Some("Careless"),
                _ => None,
            };
            if let Some(new) = remapped {
                e.insert("mistake_reason".into(), Value::String(new.into()));
                migrated = true;
            }
        }
    }

    migrated
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn splits_old_combined_subject_strings() {
        let mut db = json!({
            "mark_logbook": [
                { "subject": "Physics - Kinematics", "mistake_reason": "Conceptual Error" }
            ]
        });
        assert!(migrate(&mut db));
        let e = &db["mark_logbook"][0];
        assert_eq!(e["subject"], "Physics");
        assert_eq!(e["chapter"], "Kinematics");
        assert_eq!(e["mistake_reason"], "Conceptual");
        assert_eq!(e["difficulty"], "Medium");
    }

    #[test]
    fn a_subject_with_no_separator_keeps_an_empty_chapter() {
        let mut db = json!({ "mark_logbook": [{ "subject": "Maths", "mistake_reason": "Sign" }] });
        migrate(&mut db);
        assert_eq!(db["mark_logbook"][0]["subject"], "Maths");
        assert_eq!(db["mark_logbook"][0]["chapter"], "");
    }

    #[test]
    fn an_already_current_database_reports_no_change() {
        let mut db = serde_json::to_value(crate::db::seed::fresh_db()).unwrap();
        assert!(!migrate(&mut db), "a fresh database should need no migration");
    }
}
