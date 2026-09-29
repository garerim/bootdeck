//! Lecture et écriture du fichier des presets.
//!
//! Rust traite le contenu comme un document JSON versionné, sans connaître le
//! détail des presets : le schéma complet est validé côté TypeScript (Zod).
//! Rust garantit en revanche que l'écriture est atomique et qu'il n'écrit
//! jamais autre chose qu'un document JSON versionné.

use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::errors::AppError;

pub const PRESETS_FILE_NAME: &str = "presets.json";

/// Garde-fou : quelques dizaines de presets pèsent quelques kilo-octets.
const MAX_CONTENT_BYTES: usize = 5 * 1024 * 1024;

pub struct PresetFileStore {
    path: PathBuf,
    /// Sérialise les écritures : deux sauvegardes simultanées ne doivent pas
    /// se partager le fichier temporaire.
    write_lock: Mutex<()>,
}

impl PresetFileStore {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            write_lock: Mutex::new(()),
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Contenu du fichier, ou `None` s'il n'existe pas encore (premier lancement).
    pub fn read(&self) -> Result<Option<String>, AppError> {
        let bytes = match fs::read(&self.path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(AppError::io("read", &self.path, error)),
        };
        let text = String::from_utf8(bytes).map_err(|_| {
            let error = io::Error::new(io::ErrorKind::InvalidData, "the file is not valid UTF-8 text");
            AppError::io("read", &self.path, error)
        })?;
        // Le Bloc-notes de Windows peut ajouter une marque BOM en tête de fichier,
        // que JSON.parse refuserait.
        Ok(Some(match text.strip_prefix('\u{feff}') {
            Some(without_bom) => without_bom.to_owned(),
            None => text,
        }))
    }

    /// Remplace le fichier de façon atomique : on écrit un fichier temporaire
    /// complet, puis on le renomme. Si l'application s'arrête en plein milieu,
    /// l'ancien fichier reste intact ; on ne se retrouve jamais avec un fichier à moitié écrit.
    pub fn write(&self, content: &str) -> Result<(), AppError> {
        validate_content(content)?;
        let _guard = self.write_lock.lock().unwrap_or_else(PoisonError::into_inner);

        if let Some(directory) = self.path.parent() {
            fs::create_dir_all(directory).map_err(|error| AppError::io("create", directory, error))?;
        }

        let temporary = self.path.with_extension("json.tmp");
        write_and_sync(&temporary, content).map_err(|error| AppError::io("write", &temporary, error))?;

        // Sous Windows, `rename` remplace un fichier existant (MoveFileEx avec REPLACE_EXISTING).
        fs::rename(&temporary, &self.path).map_err(|error| {
            let _ = fs::remove_file(&temporary);
            AppError::io("replace", &self.path, error)
        })
    }

    /// Met le fichier actuel de côté (sans le modifier) et renvoie son nouveau chemin.
    pub fn backup(&self) -> Result<PathBuf, AppError> {
        let _guard = self.write_lock.lock().unwrap_or_else(PoisonError::into_inner);
        let backup = self.available_backup_path();
        fs::rename(&self.path, &backup).map_err(|error| AppError::io("back up", &self.path, error))?;
        Ok(backup)
    }

    /// `presets.invalid-<secondes Unix>.json`, suffixé si le nom est déjà pris.
    fn available_backup_path(&self) -> PathBuf {
        let seconds = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|elapsed| elapsed.as_secs())
            .unwrap_or_default();
        let mut candidate = self.path.with_file_name(format!("presets.invalid-{seconds}.json"));
        let mut counter = 1;
        while candidate.exists() {
            candidate = self.path.with_file_name(format!("presets.invalid-{seconds}-{counter}.json"));
            counter += 1;
        }
        candidate
    }
}

fn write_and_sync(path: &Path, content: &str) -> io::Result<()> {
    let mut file = File::create(path)?;
    file.write_all(content.as_bytes())?;
    // Force l'écriture sur le disque avant le renommage.
    file.sync_all()
}

/// Vérifie que le contenu reçu du front est un document JSON versionné.
fn validate_content(content: &str) -> Result<(), AppError> {
    if content.len() > MAX_CONTENT_BYTES {
        return Err(AppError::InvalidInput(format!(
            "content exceeds {} MB",
            MAX_CONTENT_BYTES / (1024 * 1024)
        )));
    }
    let document: serde_json::Value = serde_json::from_str(content)
        .map_err(|error| AppError::InvalidInput(format!("content is not valid JSON ({error})")))?;
    match document.get("schemaVersion").and_then(serde_json::Value::as_u64) {
        Some(version) if version > 0 => Ok(()),
        _ => Err(AppError::InvalidInput(
            "content must be an object with a positive schemaVersion".into(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID: &str = r#"{ "schemaVersion": 1, "presets": [] }"#;

    /// Dossier temporaire propre à chaque test, supprimé à la fin.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new(test_name: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "workspace-presets-{test_name}-{}",
                std::process::id()
            ));
            let _ = fs::remove_dir_all(&path);
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }

        fn store(&self) -> PresetFileStore {
            PresetFileStore::new(self.0.join("data").join(PRESETS_FILE_NAME))
        }

        fn files(&self) -> Vec<String> {
            let mut names: Vec<String> = fs::read_dir(self.0.join("data"))
                .unwrap()
                .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
                .collect();
            names.sort();
            names
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn read_returns_none_when_the_file_does_not_exist() {
        let dir = TempDir::new("read-missing");
        assert_eq!(dir.store().read().unwrap(), None);
    }

    #[test]
    fn write_creates_the_folder_and_the_file_can_be_read_back() {
        let dir = TempDir::new("roundtrip");
        let store = dir.store();
        store.write(VALID).unwrap();
        assert_eq!(store.read().unwrap().as_deref(), Some(VALID));
    }

    #[test]
    fn write_replaces_the_previous_content_and_leaves_no_temporary_file() {
        let dir = TempDir::new("replace");
        let store = dir.store();
        store.write(VALID).unwrap();
        let updated = r#"{ "schemaVersion": 1, "presets": [{ "name": "new" }] }"#;
        store.write(updated).unwrap();

        assert_eq!(store.read().unwrap().as_deref(), Some(updated));
        assert_eq!(dir.files(), vec![PRESETS_FILE_NAME]);
    }

    #[test]
    fn write_refuses_content_that_is_not_a_versioned_json_document() {
        let dir = TempDir::new("invalid-content");
        let store = dir.store();
        for content in ["", "not json", "[]", r#"{ "presets": [] }"#, r#"{ "schemaVersion": 0 }"#] {
            let result = store.write(content);
            assert!(
                matches!(result, Err(AppError::InvalidInput(_))),
                "{content:?} should be refused"
            );
        }
        assert_eq!(store.read().unwrap(), None, "nothing must have been written");
    }

    #[test]
    fn read_removes_a_leading_byte_order_mark() {
        let dir = TempDir::new("bom");
        let store = dir.store();
        fs::create_dir_all(store.path().parent().unwrap()).unwrap();
        fs::write(store.path(), format!("\u{feff}{VALID}")).unwrap();
        assert_eq!(store.read().unwrap().as_deref(), Some(VALID));
    }

    #[test]
    fn read_reports_a_file_that_is_not_utf8() {
        let dir = TempDir::new("not-utf8");
        let store = dir.store();
        fs::create_dir_all(store.path().parent().unwrap()).unwrap();
        fs::write(store.path(), [0xff, 0xfe, 0x00, 0x7b]).unwrap();
        assert!(matches!(store.read(), Err(AppError::Io { action: "read", .. })));
    }

    #[test]
    fn backup_moves_the_file_aside_without_changing_it() {
        let dir = TempDir::new("backup");
        let store = dir.store();
        fs::create_dir_all(store.path().parent().unwrap()).unwrap();
        fs::write(store.path(), "{ corrupted").unwrap();

        let first = store.backup().unwrap();
        fs::write(store.path(), "{ corrupted again").unwrap();
        let second = store.backup().unwrap();

        assert_ne!(first, second, "two backups in the same second must not collide");
        assert_eq!(fs::read_to_string(&first).unwrap(), "{ corrupted");
        assert_eq!(fs::read_to_string(&second).unwrap(), "{ corrupted again");
        assert_eq!(store.read().unwrap(), None);
    }

    #[test]
    fn backup_fails_when_there_is_no_file() {
        let dir = TempDir::new("backup-missing");
        assert!(matches!(dir.store().backup(), Err(AppError::Io { action: "back up", .. })));
    }
}
