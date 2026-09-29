//! Commandes de persistance des fichiers de données (presets, sessions).
//!
//! Commandes `async` : Tauri les exécute hors du thread principal, l'interface
//! ne se fige donc jamais pendant une lecture ou une écriture sur le disque.

use tauri::State;

use crate::errors::AppError;
use crate::models::{DataFile, StoredDataFile};
use crate::services::storage::DataFiles;

#[tauri::command]
pub async fn load_data_file(files: State<'_, DataFiles>, file: DataFile) -> Result<StoredDataFile, AppError> {
    let store = files.get(file);
    Ok(StoredDataFile {
        path: store.path().display().to_string(),
        content: store.read()?,
    })
}

#[tauri::command]
pub async fn save_data_file(files: State<'_, DataFiles>, file: DataFile, content: String) -> Result<(), AppError> {
    files.get(file).write(&content)
}

/// Met de côté un fichier illisible et renvoie le chemin de la copie.
#[tauri::command]
pub async fn backup_data_file(files: State<'_, DataFiles>, file: DataFile) -> Result<String, AppError> {
    Ok(files.get(file).backup()?.display().to_string())
}
