//! Implémentation macOS et Linux (sémantique Unix commune).
//!
//! ⚠️ NON COMPILÉ NI TESTÉ : le développement se fait sous Windows. À vérifier
//! sur une machine macOS/Linux ou en CI avant toute publication.

use std::io;
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{Child, Command};

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

/// Une commande gérée et ses descendants : son groupe de processus.
///
/// Contrairement au Job Object de Windows, rien n'arrête le groupe si l'application
/// plante (il faudrait `prctl(PR_SET_PDEATHSIG)` sous Linux, sans équivalent sous macOS).
pub struct ProcessTree {
    pid: u32,
}

pub fn track_process_tree(child: &Child) -> ProcessTree {
    ProcessTree { pid: child.id() }
}

impl ProcessTree {
    pub fn pid(&self) -> u32 {
        self.pid
    }

    /// Envoie SIGTERM à tout le groupe de processus (`-pid` désigne le groupe).
    pub fn kill(&self) -> io::Result<()> {
        let status = Command::new("/bin/kill")
            .args(["-s", "TERM", "--", &format!("-{}", self.pid)])
            .status()?;
        if status.success() {
            Ok(())
        } else {
            Err(io::Error::other(format!("kill failed ({status})")))
        }
    }

    /// Rien à libérer : le groupe n'est lié à aucune ressource de l'application.
    pub fn release(&self) {}
}

/// Explication lisible des refus de démarrage propres à Unix.
pub fn describe_start_error(error: &io::Error) -> Option<&'static str> {
    // ENOEXEC (même valeur sous Linux et macOS) : fichier exécutable d'un format inconnu.
    const ENOEXEC: i32 = 8;
    (error.raw_os_error() == Some(ENOEXEC)).then_some("it is not a valid program")
}

/// Rien à deviner : un shell Unix sort avec le code 127 quand la commande
/// n'existe pas, et le front sait le reconnaître.
pub fn missing_program(_command_line: &str, _working_directory: &Path) -> Option<String> {
    None
}
