//! Opérations dépendantes de l'OS.
//!
//! Chaque OS fournit les mêmes fonctions (`shell_command`, `application_command`,
//! `configure_managed_process`, `kill_process_tree`), choisies à la compilation
//! avec `#[cfg]` : un binaire ne cible qu'un seul OS, un trait n'apporterait rien.

use std::ffi::OsStr;
use std::io;

pub mod paths;

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use windows::*;

#[cfg(unix)]
mod unix;
#[cfg(unix)]
pub use unix::*;

/// Ouvre une URL ou un chemin avec l'application par défaut du système
/// (navigateur, explorateur de fichiers…), via la crate `open`.
pub fn open_with_default_app(target: impl AsRef<OsStr>) -> io::Result<()> {
    open::that_detached(target)
}
