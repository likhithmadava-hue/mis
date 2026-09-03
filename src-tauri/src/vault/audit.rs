//! A tamper-evident, append-only write log (`audit.log`).
//!
//! Each line records one vault write, chained by hash: every entry's digest
//! covers the previous entry's digest. Remove, reorder, or edit any line and
//! `verify` breaks from that point on. This does not *prevent* changes — nothing
//! running locally can stop an administrator — but it makes silent tampering
//! detectable, which is a different and achievable promise.
//!
//! The line format and the digest payload are byte-identical to the Python
//! host's `audit.py`, so an existing `audit.log` keeps verifying after the
//! rewrite instead of appearing to have been broken by it.
//!
//! **Audit failures never block a write.** The vault is the app's data; the
//! audit log is evidence about it. Losing the ability to write evidence must not
//! cost you your day's work — callers log and swallow, and `vault::write` is
//! written that way on purpose.

use std::collections::BTreeMap;
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::error::{MisError, Result};

pub const GENESIS: &str = "0000000000000000000000000000000000000000000000000000000000000000";

/// Extra context on an entry. A `BTreeMap` rather than a `HashMap` because the
/// digest covers the serialised form and Python sorted its keys — an unordered
/// map would produce a different hash on every run.
pub type Detail = BTreeMap<String, Value>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditRecord {
    pub seq: u64,
    pub ts: String,
    pub event: String,
    pub bytes: u64,
    pub prev: String,
    pub hash: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<Detail>,
}

/// The digest payload, exactly as Python built it.
///
/// Note that `detail` is serialised compactly with sorted keys. Keep detail
/// values ASCII: Python's `json.dumps` escapes non-ASCII to `\uXXXX` by default
/// and `serde_json` does not, so a non-ASCII detail written by one and verified
/// by the other would not match.
fn digest(seq: u64, ts: &str, event: &str, size: u64, prev: &str, detail: Option<&Detail>) -> String {
    let empty = Detail::new();
    let detail_str = serde_json::to_string(detail.unwrap_or(&empty)).unwrap_or_else(|_| "{}".into());
    let payload = format!("{seq}|{ts}|{event}|{size}|{prev}|{detail_str}");
    Sha256::digest(payload.as_bytes())
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect()
}

/// `(last seq, last hash)` — or `(0, GENESIS)` if the log is empty or absent.
fn tail(path: &Path) -> (u64, String) {
    let Ok(file) = std::fs::File::open(path) else {
        return (0, GENESIS.to_string());
    };
    let mut last: Option<AuditRecord> = None;
    for line in BufReader::new(file).lines().map_while(std::result::Result::ok) {
        let line = line.trim().to_string();
        if line.is_empty() {
            continue;
        }
        if let Ok(rec) = serde_json::from_str::<AuditRecord>(&line) {
            last = Some(rec);
        }
    }
    match last {
        Some(rec) => (rec.seq, rec.hash),
        None => (0, GENESIS.to_string()),
    }
}

/// Append one entry and return it.
pub fn append(path: &Path, event: &str, size: u64, detail: Option<Detail>) -> Result<AuditRecord> {
    let (seq, prev) = tail(path);
    let seq = seq + 1;
    let ts = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%z").to_string();
    let hash = digest(seq, &ts, event, size, &prev, detail.as_ref());

    let rec = AuditRecord {
        seq,
        ts,
        event: event.to_string(),
        bytes: size,
        prev,
        hash,
        // An empty detail map is omitted, matching Python's `if detail:`.
        detail: detail.filter(|d| !d.is_empty()),
    };

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| MisError::Audit(format!("could not open the audit log: {e}")))?;
    writeln!(file, "{}", serde_json::to_string(&rec)?)
        .map_err(|e| MisError::Audit(format!("could not write to the audit log: {e}")))?;

    Ok(rec)
}

/// Where the chain first breaks, or `None` if the whole log is intact.
///
/// The old Python returned a bare `bool`. Reporting the sequence number instead
/// means the app can say *which* write was tampered with rather than only that
/// something, somewhere, was.
pub fn first_break(path: &Path) -> Option<u64> {
    let Ok(file) = std::fs::File::open(path) else {
        return None; // no log yet is not a broken log
    };

    let mut prev = GENESIS.to_string();
    let mut expected_seq = 0u64;

    for line in BufReader::new(file).lines().map_while(std::result::Result::ok) {
        let line = line.trim().to_string();
        if line.is_empty() {
            continue;
        }
        expected_seq += 1;

        let Ok(rec) = serde_json::from_str::<AuditRecord>(&line) else {
            return Some(expected_seq);
        };
        if rec.seq != expected_seq || rec.prev != prev {
            return Some(expected_seq);
        }
        if digest(rec.seq, &rec.ts, &rec.event, rec.bytes, &rec.prev, rec.detail.as_ref()) != rec.hash {
            return Some(expected_seq);
        }
        prev = rec.hash;
    }
    None
}

pub fn verify(path: &Path) -> bool {
    first_break(path).is_none()
}

/// The most recent entries, newest first — what the app shows when you ask to
/// see the log.
pub fn recent(path: &Path, limit: usize) -> Vec<AuditRecord> {
    let Ok(file) = std::fs::File::open(path) else {
        return Vec::new();
    };
    let mut all: Vec<AuditRecord> = BufReader::new(file)
        .lines()
        .map_while(std::result::Result::ok)
        .filter_map(|l| serde_json::from_str(l.trim()).ok())
        .collect();
    all.reverse();
    all.truncate(limit);
    all
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_log(name: &str) -> std::path::PathBuf {
        let p = std::env::temp_dir().join(format!("mis-audit-test-{name}.log"));
        let _ = fs::remove_file(&p);
        p
    }

    #[test]
    fn a_fresh_chain_verifies() {
        let p = temp_log("fresh");
        append(&p, "key-created", 32, None).unwrap();
        append(&p, "write", 1024, None).unwrap();
        append(&p, "log-submit", 0, None).unwrap();
        assert!(verify(&p));
        let _ = fs::remove_file(&p);
    }

    #[test]
    fn entries_are_numbered_and_linked_in_order() {
        let p = temp_log("chain");
        let a = append(&p, "write", 1, None).unwrap();
        let b = append(&p, "write", 2, None).unwrap();
        assert_eq!(a.seq, 1);
        assert_eq!(a.prev, GENESIS);
        assert_eq!(b.seq, 2);
        assert_eq!(b.prev, a.hash, "each entry must point at the one before it");
        let _ = fs::remove_file(&p);
    }

    #[test]
    fn editing_a_line_breaks_the_chain_at_that_line() {
        let p = temp_log("edited");
        append(&p, "write", 100, None).unwrap();
        append(&p, "write", 200, None).unwrap();
        append(&p, "write", 300, None).unwrap();

        // Rewrite the middle entry's payload, leaving its hash alone — exactly
        // what someone quietly editing the log would do.
        let text = fs::read_to_string(&p).unwrap();
        let mut lines: Vec<String> = text.lines().map(String::from).collect();
        lines[1] = lines[1].replace("\"bytes\":200", "\"bytes\":999");
        fs::write(&p, lines.join("\n") + "\n").unwrap();

        assert_eq!(first_break(&p), Some(2));
        let _ = fs::remove_file(&p);
    }

    #[test]
    fn removing_a_line_breaks_the_chain() {
        let p = temp_log("removed");
        append(&p, "write", 1, None).unwrap();
        append(&p, "write", 2, None).unwrap();
        append(&p, "write", 3, None).unwrap();

        let text = fs::read_to_string(&p).unwrap();
        let lines: Vec<&str> = text.lines().collect();
        fs::write(&p, format!("{}\n{}\n", lines[0], lines[2])).unwrap();

        assert!(!verify(&p));
        let _ = fs::remove_file(&p);
    }

    #[test]
    fn detail_is_covered_by_the_digest() {
        let p = temp_log("detail");
        let mut d = Detail::new();
        d.insert("date".into(), Value::String("2026-08-03".into()));
        append(&p, "log-submit", 0, Some(d)).unwrap();

        let text = fs::read_to_string(&p).unwrap();
        fs::write(&p, text.replace("2026-08-03", "2026-08-04")).unwrap();
        assert!(!verify(&p), "changing a detail value must break the chain");
        let _ = fs::remove_file(&p);
    }

    #[test]
    fn a_missing_log_is_not_a_broken_log() {
        assert!(verify(&temp_log("absent")));
    }
}
