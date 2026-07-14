use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Manager;
use uuid::Uuid;

use crate::errors::AppError;
use crate::package::{load_package, save_package};
use crate::payload_text;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentFile {
    path: String,
    title: String,
    kind: String,
    last_opened: i64,
    pinned: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRecoveryRequest {
    pub payload: Value,
    pub original_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryRecord {
    id: String,
    document_id: String,
    title: String,
    kind: String,
    original_path: Option<String>,
    saved_at: i64,
}

fn timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::AppData(error.to_string()))?;
    fs::create_dir_all(&directory)?;
    Ok(directory)
}

fn recovery_dir(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let directory = app_data_dir(app)?.join("recovery");
    fs::create_dir_all(&directory)?;
    Ok(directory)
}

fn database(app: &tauri::AppHandle) -> Result<Connection, AppError> {
    let connection = Connection::open(app_data_dir(app)?.join("outofoffice.sqlite3"))?;
    connection.pragma_update(None, "journal_mode", "WAL")?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    Ok(connection)
}

pub fn initialize_database(app: &tauri::AppHandle) -> Result<(), AppError> {
    let connection = database(app)?;
    connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS recent_files (
            path TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            kind TEXT NOT NULL CHECK(kind = 'write'),
            last_opened INTEGER NOT NULL,
            pinned INTEGER NOT NULL DEFAULT 0
         );
         CREATE TABLE IF NOT EXISTS recovery (
            id TEXT PRIMARY KEY NOT NULL,
            document_id TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            kind TEXT NOT NULL CHECK(kind = 'write'),
            original_path TEXT,
            saved_at INTEGER NOT NULL
         );
         CREATE INDEX IF NOT EXISTS recovery_saved_at ON recovery(saved_at DESC);",
    )?;
    recovery_dir(app)?;
    Ok(())
}

pub fn record_recent(app: &tauri::AppHandle, path: &Path, payload: &Value) -> Result<(), AppError> {
    let normalized = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    database(app)?.execute(
        "INSERT INTO recent_files(path,title,kind,last_opened,pinned) VALUES(?1,?2,?3,?4,0)
         ON CONFLICT(path) DO UPDATE SET title=excluded.title, kind=excluded.kind, last_opened=excluded.last_opened",
        params![
            normalized.to_string_lossy(),
            payload_text(payload, "/document/metadata/title")?,
            payload_text(payload, "/kind")?,
            timestamp()
        ],
    )?;
    Ok(())
}

pub fn list_recent(app: &tauri::AppHandle) -> Result<Vec<RecentFile>, AppError> {
    let connection = database(app)?;
    let mut statement = connection.prepare(
        "SELECT path,title,kind,last_opened,pinned FROM recent_files WHERE kind='write'
         ORDER BY pinned DESC,last_opened DESC LIMIT 30",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(RecentFile {
            path: row.get(0)?,
            title: row.get(1)?,
            kind: row.get(2)?,
            last_opened: row.get(3)?,
            pinned: row.get::<_, i64>(4)? != 0,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn set_pinned(app: &tauri::AppHandle, path: &str, pinned: bool) -> Result<(), AppError> {
    let changed = database(app)?.execute(
        "UPDATE recent_files SET pinned=?1 WHERE path=?2 AND kind='write'",
        params![pinned, path],
    )?;
    if changed == 0 {
        return Err(AppError::Validation(
            "The recent-file entry no longer exists.".into(),
        ));
    }
    Ok(())
}

fn extension_for_kind(kind: &str) -> Result<&'static str, AppError> {
    if kind == "write" {
        Ok("oofdoc")
    } else {
        Err(AppError::Validation(
            "Unknown recovery document kind.".into(),
        ))
    }
}

fn snapshot_path(directory: &Path, id: &str, kind: &str) -> Result<PathBuf, AppError> {
    Ok(directory.join(format!("{id}.{}", extension_for_kind(kind)?)))
}

pub fn save_recovery_record(
    app: &tauri::AppHandle,
    request: SaveRecoveryRequest,
) -> Result<i64, AppError> {
    let document_id = payload_text(&request.payload, "/document/metadata/id")?.to_owned();
    let title = payload_text(&request.payload, "/document/metadata/title")?.to_owned();
    let kind = payload_text(&request.payload, "/kind")?.to_owned();
    let connection = database(app)?;
    let existing: Option<String> = connection
        .query_row(
            "SELECT id FROM recovery WHERE document_id=?1",
            [&document_id],
            |row| row.get(0),
        )
        .optional()?;
    let is_new = existing.is_none();
    let id = existing.unwrap_or_else(|| Uuid::new_v4().to_string());
    let path = snapshot_path(&recovery_dir(app)?, &id, &kind)?;
    save_package(&path, &request.payload)?;
    let saved_at = timestamp();
    if let Err(error) = connection.execute(
        "INSERT INTO recovery(id,document_id,title,kind,original_path,saved_at) VALUES(?1,?2,?3,?4,?5,?6)
         ON CONFLICT(document_id) DO UPDATE SET title=excluded.title,kind=excluded.kind,original_path=excluded.original_path,saved_at=excluded.saved_at",
        params![id, document_id, title, kind, request.original_path, saved_at],
    ) {
        if is_new {
            let _ = remove_if_present(&path);
        }
        return Err(error.into());
    }
    prune_recoveries(app, &connection)?;
    Ok(saved_at)
}

fn prune_recoveries(app: &tauri::AppHandle, connection: &Connection) -> Result<(), AppError> {
    let directory = recovery_dir(app)?;
    let stale: Vec<(String, String)> = {
        let mut statement = connection
            .prepare(
                "SELECT id,kind FROM recovery WHERE kind='write' ORDER BY saved_at DESC LIMIT -1 OFFSET 20",
            )?;
        let collected = statement
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect::<Result<Vec<_>, _>>()?;
        collected
    };
    for (id, kind) in stale {
        remove_if_present(&snapshot_path(&directory, &id, &kind)?)?;
        connection.execute("DELETE FROM recovery WHERE id=?1", [&id])?;
    }
    Ok(())
}

pub fn list_recovery_records(app: &tauri::AppHandle) -> Result<Vec<RecoveryRecord>, AppError> {
    let connection = database(app)?;
    let mut statement = connection.prepare(
        "SELECT id,document_id,title,kind,original_path,saved_at FROM recovery
         WHERE kind='write' ORDER BY saved_at DESC",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(RecoveryRecord {
            id: row.get(0)?,
            document_id: row.get(1)?,
            title: row.get(2)?,
            kind: row.get(3)?,
            original_path: row.get(4)?,
            saved_at: row.get(5)?,
        })
    })?;
    let records = rows.collect::<Result<Vec<_>, _>>()?;
    let directory = recovery_dir(app)?;
    Ok(records
        .into_iter()
        .filter(|record| {
            snapshot_path(&directory, &record.id, &record.kind)
                .is_ok_and(|path| path.is_file())
        })
        .collect())
}

pub fn load_recovery_record(app: &tauri::AppHandle, id: &str) -> Result<Value, AppError> {
    let connection = database(app)?;
    let kind: Option<String> = connection
        .query_row(
            "SELECT kind FROM recovery WHERE id=?1 AND kind='write'",
            [id],
            |row| row.get(0),
        )
        .optional()?;
    let kind =
        kind.ok_or_else(|| AppError::Validation("The recovery entry no longer exists.".into()))?;
    load_package(&snapshot_path(&recovery_dir(app)?, id, &kind)?)
}

pub fn clear_recovery_record(app: &tauri::AppHandle, document_id: &str) -> Result<(), AppError> {
    let connection = database(app)?;
    let row: Option<(String, String)> = connection
        .query_row(
            "SELECT id,kind FROM recovery WHERE document_id=?1 AND kind='write'",
            [document_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    if let Some((id, kind)) = row {
        remove_if_present(&snapshot_path(&recovery_dir(app)?, &id, &kind)?)?;
        connection.execute("DELETE FROM recovery WHERE id=?1", [&id])?;
    }
    Ok(())
}

pub fn discard_recovery_record(app: &tauri::AppHandle, id: &str) -> Result<(), AppError> {
    let connection = database(app)?;
    let kind: Option<String> = connection
        .query_row(
            "SELECT kind FROM recovery WHERE id=?1 AND kind='write'",
            [id],
            |row| row.get(0),
        )
        .optional()?;
    let kind =
        kind.ok_or_else(|| AppError::Validation("The recovery entry no longer exists.".into()))?;
    remove_if_present(&snapshot_path(&recovery_dir(app)?, id, &kind)?)?;
    connection.execute("DELETE FROM recovery WHERE id=?1", [id])?;
    Ok(())
}

fn remove_if_present(path: &Path) -> Result<(), AppError> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recovery_extensions_are_write_only() {
        assert_eq!(
            extension_for_kind("write").expect("write extension"),
            "oofdoc"
        );
        assert!(extension_for_kind("unsupported").is_err());
    }

    #[test]
    fn recovery_metadata_does_not_serialize_a_payload() {
        let record = RecoveryRecord {
            id: "recovery-test".into(),
            document_id: "document-test".into(),
            title: "Draft".into(),
            kind: "write".into(),
            original_path: None,
            saved_at: 0,
        };
        let serialized = serde_json::to_value(record).expect("serialize recovery metadata");
        assert!(serialized.get("payload").is_none());
    }
}
