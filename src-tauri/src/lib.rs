//! Point d'entrée de l'application Tauri.
//!
//! `main.rs` ne fait qu'appeler [`run`] : la logique vit dans la bibliothèque pour que
//! le même code serve aussi une éventuelle cible mobile (`mobile_entry_point`).

mod commands;
mod errors;
mod models;
mod services;
mod system;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        // Échec au démarrage (config invalide, WebView absente) : rien à récupérer, on s'arrête.
        .expect("error while running tauri application");
}
