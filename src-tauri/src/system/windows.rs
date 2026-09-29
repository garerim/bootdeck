//! Implémentation Windows.

use std::ffi::OsString;
use std::io;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// Aucune fenêtre de console pour le processus (ni le moindre flash).
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
/// Une console dédiée si le programme en a besoin ; ignoré par les programmes graphiques.
const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;

/// Exécute une ligne de commande telle que l'utilisateur la taperait dans `cmd`.
///
/// La ligne est transmise *brute* (`raw_arg`) : les règles d'échappement de Rust
/// (celles des programmes C) ne correspondent pas à celles de `cmd.exe` et
/// abîmeraient les guillemets. `/s` + guillemets extérieurs : `cmd` retire ces
/// guillemets et exécute le reste tel quel. `/d` : ignore les scripts AutoRun du registre.
pub fn shell_command(command_line: &str) -> Command {
    let mut command = Command::new(system32("cmd.exe"));
    command.raw_arg(format!("/d /s /c \"{command_line}\""));
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

/// Prépare le lancement d'une application, détachée de l'app.
pub fn application_command(program: &Path, args: &[String]) -> Command {
    let mut command = Command::new(program);
    command.args(args);
    // Un script `.cmd` (ex. `code.cmd` de VS Code) n'est qu'un relais vers le vrai
    // programme : sa console doit rester invisible. Un `.exe` en mode console
    // (cmd, powershell) doit au contraire obtenir sa propre fenêtre.
    let is_script = program
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("cmd") || extension.eq_ignore_ascii_case("bat"));
    command.creation_flags(if is_script { CREATE_NO_WINDOW } else { CREATE_NEW_CONSOLE });
    command
}

/// Rien à préparer : `taskkill /T` retrouve les descendants par leur processus parent.
pub fn configure_managed_process(_command: &mut Command) {}

/// Arrête le processus et tous ses descendants (ex. `cmd` → `npm` → `node`).
pub fn kill_process_tree(pid: u32) -> io::Result<()> {
    let status = Command::new(system32("taskkill.exe"))
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()?;
    // 128 : processus introuvable, il s'est déjà terminé entre-temps. Pas une erreur.
    match status.code() {
        Some(0) | Some(128) => Ok(()),
        _ => Err(io::Error::other(format!("taskkill failed ({status})"))),
    }
}

/// Chemin complet d'un outil système. Sans chemin complet, Windows chercherait
/// d'abord dans le dossier de l'application, où un faux `cmd.exe` pourrait être déposé.
fn system32(program: &str) -> PathBuf {
    let root = std::env::var_os("SystemRoot").unwrap_or_else(|| OsString::from(r"C:\Windows"));
    PathBuf::from(root).join("System32").join(program)
}
