//! Implémentation macOS et Linux (sémantique Unix commune).
//!
//! ⚠️ NON COMPILÉ NI TESTÉ : le développement se fait sous Windows. À vérifier
//! sur une machine macOS/Linux ou en CI avant toute publication.

use std::io;
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::Command;

/// Exécute une ligne de commande dans le shell de l'utilisateur.
/// `-l` (shell de connexion) charge son PATH : une app graphique lancée depuis
/// le Dock n'hérite pas du PATH configuré dans le profil (Homebrew, nvm…).
pub fn shell_command(command_line: &str) -> Command {
    let shell = std::env::var_os("SHELL")
        .filter(|shell| Path::new(shell).is_absolute())
        .unwrap_or_else(|| "/bin/sh".into());
    let mut command = Command::new(shell);
    command.arg("-l").arg("-c").arg(command_line);
    command
}

/// Prépare le lancement d'une application, détachée de l'app.
pub fn application_command(program: &Path, args: &[String]) -> Command {
    // macOS : un bundle `.app` est un dossier, qu'on lance via `open -a`.
    #[cfg(target_os = "macos")]
    if program.extension().is_some_and(|extension| extension == "app") {
        let mut command = Command::new("/usr/bin/open");
        command.arg("-a").arg(program);
        if !args.is_empty() {
            command.arg("--args").args(args);
        }
        return command;
    }

    let mut command = Command::new(program);
    command.args(args);
    // Groupe de processus propre : l'application ne reçoit pas les signaux destinés au lanceur.
    command.process_group(0);
    command
}

/// Le processus devient chef de son propre groupe : on pourra arrêter tous ses descendants d'un coup.
pub fn configure_managed_process(command: &mut Command) {
    command.process_group(0);
}

/// Envoie SIGTERM à tout le groupe de processus (`-pid` désigne le groupe).
pub fn kill_process_tree(pid: u32) -> io::Result<()> {
    let status = Command::new("/bin/kill")
        .args(["-s", "TERM", "--", &format!("-{pid}")])
        .status()?;
    if status.success() {
        Ok(())
    } else {
        Err(io::Error::other(format!("kill failed ({status})")))
    }
}
