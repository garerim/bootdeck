//! Point d'entrée de l'application Tauri.
//!
//! `main.rs` ne fait qu'appeler [`run`] : la logique vit dans la bibliothèque pour que
//! le même code serve aussi une éventuelle cible mobile (`mobile_entry_point`).

mod commands;
mod errors;
mod models;
mod services;
mod system;

/// Pour les tests d'intégration de l'IPC (`tests/ipc.rs`) uniquement.
#[doc(hidden)]
pub mod ipc_test_support {
    pub use crate::invoke_handler;
    pub use crate::models::ProcessEvent;
    pub use crate::services::processes::ProcessRegistry;
    pub use crate::services::storage::DataFiles;
}

use tauri::ipc::Invoke;
use tauri::{Manager, RunEvent, Runtime};

use services::processes::ProcessRegistry;
use services::storage::DataFiles;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // Premier plugin, avant toute initialisation : une deuxième instance s'arrête
    // aussitôt et c'est la fenêtre déjà ouverte qui revient au premier plan. Deux
    // instances écriraient chacune leur version de presets.json et l'une écraserait l'autre.
    // Les arguments transmis par la deuxième instance sont ignorés.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        focus_main_window(app);
    }));

    builder
        // Utilisé uniquement depuis Rust (commands/dialogs.rs). Son API JavaScript reste
        // bloquée : aucune permission `dialog:*` n'est accordée dans les capabilities.
        .plugin(tauri_plugin_dialog::init())
        .manage(ProcessRegistry::default())
        .setup(|app| {
            // Dossier de données propre à l'app (Windows : %APPDATA%\dev.startdeck.desktop).
            let data_directory = app.path().app_data_dir()?;
            app.manage(DataFiles::new(&data_directory));
            Ok(())
        })
        .invoke_handler(invoke_handler())
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

/// Commandes exposées au front. Partagé avec les tests d'IPC (`tests/ipc.rs`), qui
/// vérifient ainsi exactement ce que l'app enregistre. Chaque commande doit aussi
/// être déclarée dans `build.rs` et autorisée dans `capabilities/default.json`.
pub fn invoke_handler<R: Runtime>() -> impl Fn(Invoke<R>) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
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
    ]
}

#[cfg(desktop)]
fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
