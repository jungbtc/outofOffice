use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::errors::AppError;
use crate::payload_text;

const MAX_PACKAGE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_ENTRY_COUNT: usize = 128;
const MAX_JSON_BYTES: usize = 32 * 1024 * 1024;

#[derive(Default)]
struct CountingWriter {
    bytes: usize,
}

impl Write for CountingWriter {
    fn write(&mut self, buffer: &[u8]) -> std::io::Result<usize> {
        self.bytes = self.bytes.saturating_add(buffer.len());
        Ok(buffer.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDocumentRequest {
    pub path: String,
    pub payload: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedPackage {
    pub path: String,
    pub payload: Value,
}

pub fn validate_payload(payload: &Value) -> Result<(), AppError> {
    let root = payload
        .as_object()
        .ok_or_else(|| AppError::Validation("The package payload must be an object.".into()))?;
    if root.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
        return Err(AppError::Validation(
            "Only package schema version 1 is supported.".into(),
        ));
    }
    let kind = payload_text(payload, "/kind")?;
    if kind != "write" {
        return Err(AppError::Validation(format!(
            "Unknown document kind {kind}."
        )));
    }
    if payload_text(payload, "/document/kind")? != kind {
        return Err(AppError::Validation(
            "Document kind does not match package kind.".into(),
        ));
    }
    if payload
        .pointer("/document/formatVersion")
        .and_then(Value::as_u64)
        != Some(1)
    {
        return Err(AppError::Validation(
            "Only document format version 1 is supported.".into(),
        ));
    }
    let id = payload_text(payload, "/document/metadata/id")?;
    let title = payload_text(payload, "/document/metadata/title")?;
    if id.is_empty() || id.len() > 200 || title.is_empty() || title.len() > 512 {
        return Err(AppError::Validation(
            "Document metadata lengths are invalid.".into(),
        ));
    }
    payload_text(payload, "/document/content/html")?;
    if !payload
        .pointer("/document/page")
        .is_some_and(Value::is_object)
    {
        return Err(AppError::Validation(
            "Write page settings are missing.".into(),
        ));
    }
    let mut counter = CountingWriter::default();
    serde_json::to_writer(&mut counter, payload)?;
    if counter.bytes > MAX_JSON_BYTES {
        return Err(AppError::Validation(
            "Document data exceeds the 32 MiB limit.".into(),
        ));
    }
    Ok(())
}

fn expected_extension(payload: &Value) -> Result<&'static str, AppError> {
    let kind = payload_text(payload, "/kind")?;
    if kind == "write" {
        Ok("oofdoc")
    } else {
        Err(AppError::Validation(format!("Unknown kind {kind}.")))
    }
}

fn validate_extension(path: &Path, payload: &Value) -> Result<(), AppError> {
    let actual = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let expected = expected_extension(payload)?;
    if !actual.eq_ignore_ascii_case(expected) {
        return Err(AppError::Validation(format!(
            "Expected a .{expected} file, not .{actual}."
        )));
    }
    Ok(())
}

pub fn save_package(path: &Path, payload: &Value) -> Result<(), AppError> {
    validate_payload(payload)?;
    validate_extension(path, payload)?;
    let parent = path
        .parent()
        .ok_or_else(|| AppError::Validation("The save path has no parent directory.".into()))?;
    if !parent.is_dir() {
        return Err(AppError::Validation(
            "The save folder does not exist.".into(),
        ));
    }
    let filename = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("document");
    let temporary = parent.join(format!(".{filename}.{}.tmp", Uuid::new_v4()));
    let result =
        write_package_file(&temporary, payload).and_then(|()| atomic_replace(&temporary, path));
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn write_package_file(path: &Path, payload: &Value) -> Result<(), AppError> {
    let file = OpenOptions::new().write(true).create_new(true).open(path)?;
    let mut archive = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);
    let manifest = json!({
        "format": "outofOffice package",
        "schemaVersion": 1,
        "kind": payload_text(payload, "/kind")?,
        "documentId": payload_text(payload, "/document/metadata/id")?,
        "createdBy": "outofOffice 0.1.0"
    });
    archive.start_file("manifest.json", options)?;
    serde_json::to_writer_pretty(&mut archive, &manifest)?;
    archive.start_file("content.json", options)?;
    serde_json::to_writer(&mut archive, payload)?;
    archive.start_file("styles.json", options)?;
    archive.write_all(b"{\"schemaVersion\":1}")?;
    archive.start_file("metadata.json", options)?;
    serde_json::to_writer(
        &mut archive,
        payload
            .pointer("/document/metadata")
            .unwrap_or(&Value::Null),
    )?;
    archive.add_directory("media/", options)?;
    archive.add_directory("previews/", options)?;
    let file = archive.finish()?;
    file.sync_all()?;
    Ok(())
}

pub fn load_package(path: &Path) -> Result<Value, AppError> {
    let metadata = fs::metadata(path)?;
    if !metadata.is_file() || metadata.len() > MAX_PACKAGE_BYTES {
        return Err(AppError::Archive(
            "Package size is invalid or exceeds 64 MiB.".into(),
        ));
    }
    let file = File::open(path)?;
    let mut archive = ZipArchive::new(file)?;
    if archive.len() > MAX_ENTRY_COUNT {
        return Err(AppError::Archive(
            "Package contains too many entries.".into(),
        ));
    }
    let mut total_size = 0_u64;
    let mut content_index = None;
    for index in 0..archive.len() {
        let entry = archive.by_index(index)?;
        total_size = total_size.saturating_add(entry.size());
        if total_size > MAX_PACKAGE_BYTES {
            return Err(AppError::Archive(
                "Uncompressed package data exceeds 64 MiB.".into(),
            ));
        }
        let name = entry.name();
        if name.contains('\\') || entry.enclosed_name().is_none() {
            return Err(AppError::Archive(format!("Unsafe archive path {name}.")));
        }
        if name == "content.json" {
            content_index = Some(index);
        }
    }
    let index =
        content_index.ok_or_else(|| AppError::Archive("content.json is missing.".into()))?;
    let entry = archive.by_index(index)?;
    if entry.size() as usize > MAX_JSON_BYTES {
        return Err(AppError::Archive(
            "content.json exceeds the 32 MiB limit.".into(),
        ));
    }
    let mut bytes = Vec::with_capacity(entry.size() as usize);
    entry
        .take(MAX_JSON_BYTES as u64 + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() > MAX_JSON_BYTES {
        return Err(AppError::Archive(
            "content.json exceeds the 32 MiB limit.".into(),
        ));
    }
    let payload: Value = serde_json::from_slice(&bytes)?;
    drop(bytes);
    validate_payload(&payload)?;
    validate_extension(path, &payload)?;
    Ok(payload)
}

#[cfg(windows)]
fn atomic_replace(source: &Path, destination: &Path) -> Result<(), AppError> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let source_wide: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let destination_wide: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let result = unsafe {
        MoveFileExW(
            source_wide.as_ptr(),
            destination_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        Err(std::io::Error::last_os_error().into())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn atomic_replace(source: &Path, destination: &Path) -> Result<(), AppError> {
    fs::rename(source, destination)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(title: &str) -> Value {
        json!({
            "schemaVersion": 1,
            "kind": "write",
            "document": {
                "kind": "write",
                "formatVersion": 1,
                "metadata": {
                    "id": "document-test",
                    "title": title,
                    "createdAt": "2026-07-14T00:00:00.000Z",
                    "modifiedAt": "2026-07-14T00:00:00.000Z",
                    "author": ""
                },
                "page": {"size": "A4", "orientation": "portrait", "marginMm": 20},
                "content": {"html": "<p>안녕하세요 Hello</p>"}
            }
        })
    }

    #[test]
    fn rejects_mismatched_kinds() {
        let payload =
            json!({"schemaVersion": 1, "kind": "write", "document": {"kind": "unsupported"}});
        assert!(validate_payload(&payload).is_err());
    }

    #[test]
    fn rejects_non_write_packages() {
        let mut payload = sample("Unsupported");
        payload["kind"] = json!("unsupported");
        payload["document"]["kind"] = json!("unsupported");
        assert!(validate_payload(&payload).is_err());
    }

    #[test]
    fn atomically_saves_and_reopens_unicode_content() {
        let directory = std::env::temp_dir().join(format!("outofoffice-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&directory).expect("create test directory");
        let path = directory.join("문서 📝.oofdoc");
        save_package(&path, &sample("First")).expect("save first package");
        save_package(&path, &sample("Second")).expect("replace package");
        let loaded = load_package(&path).expect("load package");
        assert_eq!(
            loaded.pointer("/document/metadata/title"),
            Some(&json!("Second"))
        );
        fs::remove_file(&path).expect("remove test package");
        fs::remove_dir(&directory).expect("remove test directory");
    }

    #[test]
    fn rejects_archive_path_traversal() {
        let directory = std::env::temp_dir().join(format!("outofoffice-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&directory).expect("create test directory");
        let path = directory.join("unsafe.oofdoc");
        let file = File::create(&path).expect("create unsafe package");
        let mut writer = ZipWriter::new(file);
        writer
            .start_file("../content.json", SimpleFileOptions::default())
            .expect("start unsafe entry");
        writer
            .write_all(&serde_json::to_vec(&sample("Unsafe")).expect("serialize"))
            .expect("write unsafe entry");
        writer.finish().expect("finish unsafe package");
        assert!(matches!(load_package(&path), Err(AppError::Archive(_))));
        fs::remove_file(&path).expect("remove unsafe package");
        fs::remove_dir(&directory).expect("remove test directory");
    }
}
