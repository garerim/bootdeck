//! Structures échangées avec le front via l'IPC (sérialisées avec serde).

use serde::{Deserialize, Serialize};

/// Fichier de données désigné par le front. Une liste fermée : le front ne peut
/// jamais fournir un chemin, donc jamais viser un autre fichier du disque.
/// JSON : `"presets"` ou `"sessions"`.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DataFile {
    Presets,
    Sessions,
}

/// Réponse de `load_data_file`.
#[derive(Debug, Serialize)]
pub struct StoredDataFile {
    /// Emplacement du fichier, affiché dans les réglages et les messages d'erreur.
    pub path: String,
    /// `None` au premier lancement, quand le fichier n'existe pas encore.
    pub content: Option<String>,
}

/// Paramètres de `launch_application`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LaunchApplicationRequest {
    /// Nom de programme présent dans le PATH (`code`) ou chemin complet.
    pub path: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub working_directory: Option<String>,
}

/// Paramètres de `execute_command`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExecuteCommandRequest {
    pub command: String,
    pub working_directory: Option<String>,
}

/// Identifiant d'un processus lancé par l'app. Volontairement distinct du PID
/// de l'OS, qui peut être réattribué à un autre programme après la fin du processus.
pub type ProcessId = u64;

/// Événements d'un processus géré, envoyés au front au fil de l'eau.
/// JSON : `{ "type": "stdout", "line": "…" }`, `{ "type": "exited", "code": 1 }`.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ProcessEvent {
    Stdout { line: String },
    Stderr { line: String },
    /// `code` est absent si le processus a été tué par un signal (Unix).
    Exited { code: Option<i32> },
}
