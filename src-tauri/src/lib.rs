//! Point d'entrée de l'application Tauri.
//!
//! `main.rs` ne fait qu'appeler [`run`] : la logique vit dans la bibliothèque pour que
//! le même code serve aussi une éventuelle cible mobile (`mobile_entry_point`).

mod commands;
mod errors;
mod models;
mod services;
mod system;

use tauri::{Manager, RunEvent};

use services::processes::ProcessRegistry;
use services::storage::DataFiles;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Utilisé uniquement depuis Rust (commands/dialogs.rs). Son API JavaScript reste
        // bloquée : aucune permission `dialog:*` n'est accordée dans les capabilities.
        .plugin(tauri_plugin_dialog::init())
        .manage(ProcessRegistry::default())
        .setup(|app| {
            // Dossier de données propre à l'app (Windows : %APPDATA%\dev.workspacepresets.desktop).
            let data_directory = app.path().app_data_dir()?;
            app.manage(DataFiles::new(&data_directory));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::storage::load_data_file,
            commands::storage::save_data_file,
            commands::storage::backup_data_file,
            commands::launcher::open_url,
            commands::launcher::open_folder,
            commands::launcher::launch_application,
            commands::processes::execute_command,
            commands::processes::stop_process,
            commands::dialogs::pick_folder,
            commands::dialogs::pick_program,
        ])
        .build(tauri::generate_context!())
        // Échec au démarrage (config invalide, WebView absente) : rien à récupérer, on s'arrête.
        .expect("error while building tauri application")
        .run(|app, event| {
            // Les commandes lancées par l'app (ex. `npm run dev`) s'arrêtent avec elle :
            // sinon elles tourneraient en arrière-plan, invisibles, en occupant leurs ports.
            if let RunEvent::Exit = event {
                app.state::<ProcessRegistry>().stop_all();
            }
        });
}
