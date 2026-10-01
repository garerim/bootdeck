//! Implémentation macOS et Linux (sémantique Unix commune).
//!
//! Linux : compilé et testé (Debian 12, `cargo test`). macOS : NON COMPILÉ NI TESTÉ.

use std::io;
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{Child, Command};
use std::thread;
use std::time::Duration;

/// Délai laissé à une commande pour s'arrêter proprement (SIGTERM) avant SIGKILL.
const GRACE_PERIOD: Duration = Duration::from_secs(3);

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
/// Limite : contrairement au Job Object de Windows, rien n'arrête le groupe si
/// l'application plante (seule une fermeture normale arrête les commandes).
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

    /// Demande à tout le groupe de s'arrêter (SIGTERM, que `npm run dev` et les
    /// serveurs traitent proprement), puis le force (SIGKILL, impossible à ignorer)
    /// s'il est encore là après `GRACE_PERIOD`.
    pub fn kill(&self) -> io::Result<()> {
        let group = self.pid;
        signal_group(group, libc::SIGTERM)?;
        thread::spawn(move || {
            thread::sleep(GRACE_PERIOD);
            if group_is_alive(group) {
                let _ = signal_group(group, libc::SIGKILL);
            }
        });
        Ok(())
    }

    /// Rien à libérer : le groupe n'est lié à aucune ressource de l'application.
    pub fn release(&self) {}
}

/// Envoie un signal à un groupe de processus. Un groupe déjà terminé n'est pas une erreur.
fn signal_group(group: u32, signal: libc::c_int) -> io::Result<()> {
    let group = libc::pid_t::try_from(group).map_err(|_| io::Error::other("invalid process id"))?;
    // SAFETY: kill(2) ne reçoit que des entiers ; un identifiant négatif désigne le groupe.
    if unsafe { libc::kill(-group, signal) } == 0 {
        return Ok(());
    }
    let error = io::Error::last_os_error();
    if error.raw_os_error() == Some(libc::ESRCH) {
        Ok(())
    } else {
        Err(error)
    }
}

/// Signal 0 : aucun effet, mais réussit tant qu'un processus du groupe existe.
/// L'identifiant d'un groupe vivant ne peut pas être réattribué à un autre programme.
fn group_is_alive(group: u32) -> bool {
    let Ok(group) = libc::pid_t::try_from(group) else { return false };
    // SAFETY: voir `signal_group`.
    unsafe { libc::kill(-group, 0) == 0 }
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
