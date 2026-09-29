//! Commandes `#[tauri::command]` exposées au front.
//!
//! Chaque commande reste fine : désérialiser l'entrée, appeler un service,
//! convertir l'erreur. Aucune logique système ici.
//!
//! Toute nouvelle commande doit aussi être déclarée dans `build.rs` et autorisée
//! dans `capabilities/default.json`, sinon Tauri la refuse.

pub mod launcher;
pub mod processes;
pub mod storage;
