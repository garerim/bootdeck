//! Point d'entrée de l'application Tauri.
//!
//! `main.rs` ne fait qu'appeler [`run`] : la logique vit dans la bibliothèque pour que
//! le même code serve aussi une éventuelle cible mobile (`mobile_entry_point`).

mod commands;
mod errors;
mod models;
mod services;
mod system;

use tauri::Manager;

use services::storage::{PresetFileStore, PRESETS_FILE_NAME};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Dossier de données propre à l'app (Windows : %APPDATA%\dev.workspacepresets.desktop).
            let data_directory = app.path().app_data_dir()?;
            app.manage(PresetFileStore::new(data_directory.join(PRESETS_FILE_NAME)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::storage::load_presets,
            commands::storage::save_presets,
            commands::storage::backup_presets_file,
        ])
        .run(tauri::generate_context!())
        // Échec au démarrage (config invalide, WebView absente) : rien à récupérer, on s'arrête.
        .expect("error while running tauri application");
}
