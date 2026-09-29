//! Type d'erreur unique de l'application, sérialisable vers le front.
//!
//! Chaque erreur arrive côté TypeScript sous la forme `{ kind, message }` :
//! `kind` permet au code de réagir, `message` s'affiche tel quel.

use std::path::PathBuf;

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    /// Opération sur le système de fichiers qui a échoué (droits, disque plein…).
    #[error("Could not {action} {}: {source}", path.display())]
    Io {
        action: &'static str,
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    /// Donnée reçue du front refusée par Rust (on ne fait jamais confiance à l'IPC).
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    /// Dossier, programme ou dossier de travail introuvable sur cette machine.
    #[error("{what} not found: {target}")]
    NotFound { what: &'static str, target: String },

    /// Le système a refusé d'ouvrir une URL ou un dossier.
    #[error("Could not open {target}: {source}")]
    Open {
        target: String,
        #[source]
        source: std::io::Error,
    },

    /// Échec de l'arrêt d'un processus lancé par l'application.
    #[error("Could not stop process {pid}: {source}")]
    Stop {
        pid: u32,
        #[source]
        source: std::io::Error,
    },
}

impl AppError {
    pub fn io(action: &'static str, path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        Self::Io {
            action,
            path: path.into(),
            source,
        }
    }

    pub fn not_found(what: &'static str, target: impl std::fmt::Display) -> Self {
        Self::NotFound {
            what,
            target: target.to_string(),
        }
    }

    fn kind(&self) -> &'static str {
        match self {
            Self::Io { .. } => "io",
            Self::InvalidInput(_) => "invalid-input",
            Self::NotFound { .. } => "not-found",
            Self::Open { .. } => "open-failed",
            Self::Stop { .. } => "stop-failed",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut error = serializer.serialize_struct("AppError", 2)?;
        error.serialize_field("kind", self.kind())?;
        error.serialize_field("message", &self.to_string())?;
        error.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_as_kind_and_message() {
        let error = AppError::InvalidInput("content is empty".into());
        let json = serde_json::to_value(&error).unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "kind": "invalid-input", "message": "Invalid input: content is empty" })
        );
    }

    #[test]
    fn io_message_names_the_action_and_the_file() {
        let source = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "access denied");
        let error = AppError::io("write", "C:/data/presets.json", source);
        assert_eq!(error.to_string(), "Could not write C:/data/presets.json: access denied");
    }
}
