//! A stable fingerprint of one day's log, used to lock it on submit and to
//! detect any later change.
//!
//! The hash covers exactly what the Daily Log lets you enter for that day: the
//! day's metric (minus the lock bookkeeping itself), which habits were ticked,
//! and that day's topics. Keys are ordered and lists are sorted so the same data
//! always hashes the same way, whatever order it was entered in.
//!
//! ## Why this builds the string by hand
//!
//! The old implementation was `JSON.stringify({ m, h, t })` in the browser. Any
//! vault already on disk carries hashes produced that way, so this function has
//! to reproduce **JavaScript's** JSON output byte for byte or every previously
//! locked day would come back reading as tampered with — a red banner accusing
//! you of editing a file you never touched.
//!
//! The one place Rust and JavaScript disagree is whole numbers. `serde_json`
//! writes an `f64` of 5 as `5.0`; `JSON.stringify` writes `5`. Since almost
//! every number here (study hours, water count, mood) is usually integral, that
//! single difference would break nearly every stored hash. `js_number` below is
//! the fix, and it is the only reason this is not four lines of `serde_json`.

use sha2::{Digest, Sha256};

use super::types::{DailyMetric, TopicItem};

/// Format an `f64` the way `JSON.stringify` would.
///
/// Rust and JS both print the shortest representation that round-trips, so they
/// already agree on fractions (`5.5` → `"5.5"`, and both print
/// `0.30000000000000004` for `0.1 + 0.2`). They differ only on integral values,
/// which Rust renders with a trailing `.0`. Non-finite values cannot occur in a
/// stored metric, but JS writes them as `null`, so we do too rather than emit
/// something that is not valid JSON.
fn js_number(n: f64) -> String {
    if !n.is_finite() {
        return "null".into();
    }
    if n.fract() == 0.0 && n.abs() < 1e21 {
        format!("{}", n as i64)
    } else {
        format!("{}", n)
    }
}

/// Escape a string the way `JSON.stringify` would. Both languages escape the
/// same set — quote, backslash, and the C0 controls — and both leave non-ASCII
/// characters as literal UTF-8 rather than `\u` escapes.
fn js_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{08}' => out.push_str("\\b"),
            '\u{0c}' => out.push_str("\\f"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn js_bool(b: bool) -> &'static str {
    if b {
        "true"
    } else {
        "false"
    }
}

/// The exact string the old browser code hashed. Key order is the insertion
/// order of the TS object literal and must not be rearranged.
fn canonical_day(metric: &DailyMetric, habit_ids_done: &[String], topics: &[TopicItem]) -> String {
    // Deliberately excludes locked / submitted_at / submit_hash — the
    // fingerprint is of the *data*, not of the lock state wrapped around it.
    let m = format!(
        concat!(
            "{{\"date\":{},\"study_hours\":{},\"dpps_got\":{},\"dpps_complete\":{},",
            "\"reading_habit\":{},\"revision_habit\":{},\"mood_score\":{},",
            "\"well_spent_time\":{},\"posture_count\":{},\"water_count\":{}}}"
        ),
        js_string(&metric.date),
        js_number(metric.study_hours),
        js_number(metric.dpps_got),
        js_number(metric.dpps_complete),
        js_bool(metric.reading_habit),
        js_bool(metric.revision_habit),
        js_number(metric.mood_score),
        js_number(metric.well_spent_time),
        js_number(metric.posture_count),
        js_number(metric.water_count),
    );

    let mut habits: Vec<&str> = habit_ids_done.iter().map(String::as_str).collect();
    habits.sort_unstable();
    let h = format!(
        "[{}]",
        habits.iter().map(|id| js_string(id)).collect::<Vec<_>>().join(",")
    );

    let mut sorted: Vec<&TopicItem> = topics.iter().collect();
    sorted.sort_by(|a, b| a.id.cmp(&b.id));
    let t = format!(
        "[{}]",
        sorted
            .iter()
            .map(|x| {
                // serde renders TopicType lowercase; unwrap is safe because the
                // enum has no failing serialisation path.
                let kind = serde_json::to_string(&x.kind).unwrap_or_else(|_| "\"taught\"".into());
                format!(
                    "{{\"id\":{},\"name\":{},\"type\":{},\"done\":{}}}",
                    js_string(&x.id),
                    js_string(&x.name),
                    kind,
                    js_bool(x.done)
                )
            })
            .collect::<Vec<_>>()
            .join(",")
    );

    format!("{{\"m\":{},\"h\":{},\"t\":{}}}", m, h, t)
}

/// SHA-256 of the day, lowercase hex — the same encoding the browser produced.
pub fn hash_day(metric: &DailyMetric, habit_ids_done: &[String], topics: &[TopicItem]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(canonical_day(metric, habit_ids_done, topics).as_bytes());
    hasher
        .finalize()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::types::TopicType;

    fn metric() -> DailyMetric {
        let mut m = DailyMetric::blank("m1".into(), "2026-08-03".into());
        m.study_hours = 5.0;
        m.mood_score = 7.5;
        m
    }

    #[test]
    fn whole_numbers_print_without_a_trailing_zero() {
        // The entire reason this module hand-builds JSON.
        assert_eq!(js_number(5.0), "5");
        assert_eq!(js_number(0.0), "0");
        assert_eq!(js_number(5.5), "5.5");
        assert_eq!(js_number(-3.0), "-3");
    }

    #[test]
    fn canonical_form_matches_the_browsers_json_stringify() {
        let s = canonical_day(&metric(), &[], &[]);
        assert!(s.starts_with(r#"{"m":{"date":"2026-08-03","study_hours":5,"dpps_got":4"#));
        assert!(s.contains(r#""mood_score":7.5"#));
        assert!(s.ends_with(r#""h":[],"t":[]}"#));
    }

    #[test]
    fn habit_and_topic_order_does_not_change_the_hash() {
        let topics = vec![
            TopicItem { id: "b".into(), date: "2026-08-03".into(), name: "Two".into(), kind: TopicType::Revise, done: false },
            TopicItem { id: "a".into(), date: "2026-08-03".into(), name: "One".into(), kind: TopicType::Taught, done: true },
        ];
        let reversed: Vec<TopicItem> = topics.iter().rev().cloned().collect();

        let one = hash_day(&metric(), &["z".into(), "a".into()], &topics);
        let two = hash_day(&metric(), &["a".into(), "z".into()], &reversed);
        assert_eq!(one, two);
    }

    #[test]
    fn changing_the_data_changes_the_hash() {
        let mut edited = metric();
        edited.water_count = 8.0;
        assert_ne!(hash_day(&metric(), &[], &[]), hash_day(&edited, &[], &[]));
    }

    #[test]
    fn locking_fields_are_excluded_from_the_fingerprint() {
        let mut locked = metric();
        locked.locked = Some(true);
        locked.submitted_at = Some("2026-08-03T21:00:00+05:30".into());
        locked.submit_hash = Some("deadbeef".into());
        assert_eq!(hash_day(&metric(), &[], &[]), hash_day(&locked, &[], &[]));
    }
}
