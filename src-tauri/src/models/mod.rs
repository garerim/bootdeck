//! Structures échangées avec le front via l'IPC (sérialisées avec serde).

use serde::Serialize;

/// Réponse de `load_presets`.
#[derive(Debug, Serialize)]
pub struct StoredPresetsFile {
    /// Emplacement du fichier, affiché dans les réglages et les messages d'erreur.
    pub path: String,
    /// `None` au premier lancement, quand le fichier n'existe pas encore.
    pub content: Option<String>,
}
