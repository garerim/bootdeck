//! Commandes de persistance des presets.
//!
//! Commandes `async` : Tauri les exécute hors du thread principal, l'interface
//! ne se fige donc jamais pendant une lecture ou une écriture sur le disque.

use tauri::State;

use crate::errors::AppError;
use crate::models::StoredPresetsFile;
use crate::services::storage::PresetFileStore;

#[tauri::command]
pub async fn load_presets(store: State<'_, PresetFileStore>) -> Result<StoredPresetsFile, AppError> {
    Ok(StoredPresetsFile {
        path: store.path().display().to_string(),
        content: store.read()?,
    })
}

#[tauri::command]
pub async fn save_presets(store: State<'_, PresetFileStore>, content: String) -> Result<(), AppError> {
    store.write(&content)
}

/// Met de côté un fichier illisible et renvoie le chemin de la copie.
#[tauri::command]
pub async fn backup_presets_file(store: State<'_, PresetFileStore>) -> Result<String, AppError> {
    Ok(store.backup()?.display().to_string())
}
