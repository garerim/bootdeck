//! Commandes `#[tauri::command]` exposées au front.
//!
//! Chaque commande reste fine : désérialiser l'entrée, appeler un service,
//! convertir l'erreur. Aucune logique système ici.

pub mod storage;
