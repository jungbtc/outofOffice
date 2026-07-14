mod errors;
mod package;
mod storage;

use std::path::PathBuf;

use errors::AppError;
use package::{load_package, save_package, LoadedPackage, SaveDocumentRequest};
use serde_json::Value;
use storage::{
    clear_recovery_record, discard_recovery_record, initialize_database, list_recent,
    list_recovery_records, record_recent, save_recovery_record, set_pinned, RecentFile,
    RecoveryRecord, SaveRecoveryRequest,
};

#[tauri::command]
fn save_document(app: tauri::AppHandle, request: SaveDocumentRequest) -> Result<String, AppError> {
    let path = PathBuf::from(&request.path);
    save_package(&path, &request.payload)?;
    record_recent(&app, &path, &request.payload)?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn load_document(app: tauri::AppHandle, path: String) -> Result<LoadedPackage, AppError> {
    let path = PathBuf::from(path);
    let payload = load_package(&path)?;
    record_recent(&app, &path, &payload)?;
    Ok(LoadedPackage {
        path: path.to_string_lossy().into_owned(),
        payload,
    })
}

#[tauri::command]
fn list_recent_files(app: tauri::AppHandle) -> Result<Vec<RecentFile>, AppError> {
    list_recent(&app)
}

#[tauri::command]
fn set_recent_pinned(app: tauri::AppHandle, path: String, pinned: bool) -> Result<(), AppError> {
    set_pinned(&app, &path, pinned)
}

#[tauri::command]
fn save_recovery(app: tauri::AppHandle, request: SaveRecoveryRequest) -> Result<i64, AppError> {
    save_recovery_record(&app, request)
}

#[tauri::command]
fn list_recoveries(app: tauri::AppHandle) -> Result<Vec<RecoveryRecord>, AppError> {
    list_recovery_records(&app)
}

#[tauri::command]
fn clear_recovery(app: tauri::AppHandle, document_id: String) -> Result<(), AppError> {
    clear_recovery_record(&app, &document_id)
}

#[tauri::command]
fn discard_recovery(app: tauri::AppHandle, id: String) -> Result<(), AppError> {
    discard_recovery_record(&app, &id)
}

#[tauri::command]
fn list_launch_files() -> Vec<String> {
    std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .filter(|path| {
            path.extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| {
                    matches!(
                        extension.to_ascii_lowercase().as_str(),
                        "oofdoc" | "oofslides" | "oofsheet"
                    )
                })
                .unwrap_or(false)
        })
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            initialize_database(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_document,
            load_document,
            list_recent_files,
            set_recent_pinned,
            save_recovery,
            list_recoveries,
            clear_recovery,
            discard_recovery,
            list_launch_files
        ])
        .run(tauri::generate_context!())
        .expect("failed to run outofOffice");
}

fn payload_text<'a>(payload: &'a Value, pointer: &str) -> Result<&'a str, AppError> {
    payload
        .pointer(pointer)
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::Validation(format!("Missing or invalid {pointer}.")))
}
