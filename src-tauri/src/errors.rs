use serde::{ser::Serializer, Serialize};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("File operation failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("The document package is invalid: {0}")]
    Archive(String),
    #[error("The document data is invalid: {0}")]
    Validation(String),
    #[error("Local metadata storage failed: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Application data directory is unavailable: {0}")]
    AppData(String),
}

impl From<zip::result::ZipError> for AppError {
    fn from(error: zip::result::ZipError) -> Self {
        Self::Archive(error.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        Self::Validation(error.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
