//! Implémentation Windows.

use std::ffi::OsString;
use std::io;
use std::os::windows::io::AsRawHandle;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::ptr;

use windows_sys::core::BOOL;
use windows_sys::Win32::Foundation::{
    CloseHandle, ERROR_ACCESS_DISABLED_BY_POLICY, ERROR_BAD_EXE_FORMAT, ERROR_ELEVATION_REQUIRED,
    ERROR_EXE_MACHINE_TYPE_MISMATCH, HANDLE,
};
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation, SetInformationJobObject,
    TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT, JOB_OBJECT_LIMIT_BREAKAWAY_OK,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};

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

/// Rien à préparer avant le démarrage : le processus rejoint son job juste après (`track_process_tree`).
pub fn configure_managed_process(_command: &mut Command) {}

/// Une commande gérée et tous les processus qu'elle démarre (ex. `cmd` → `npm` → `node`).
///
/// Les processus sont regroupés dans un *Job Object* Windows :
/// - `kill` arrête tout le job d'un coup, même un descendant dont le parent est déjà mort ;
/// - si l'application disparaît sans pouvoir arrêter ses commandes (plantage, fin de
///   tâche), Windows ferme le job et tue ses processus (`KILL_ON_JOB_CLOSE`) :
///   aucun serveur ne reste orphelin en occupant son port.
pub struct ProcessTree {
    pid: u32,
    /// `None` si Windows a refusé de créer le job : l'arrêt passe alors par `taskkill /T`,
    /// comme avant, sans la protection en cas de plantage.
    job: Option<JobObject>,
}

/// Place le processus qui vient de démarrer dans un job qui lui est propre.
///
/// Limite connue : entre la création du processus et son entrée dans le job, il
/// s'écoule quelques microsecondes pendant lesquelles un enfant créé échapperait
/// au job. `cmd.exe` met bien plus longtemps à démarrer ; l'éviter tout à fait
/// demanderait de créer le processus suspendu, ce que `std::process` ne permet pas.
pub fn track_process_tree(child: &Child) -> ProcessTree {
    let job = JobObject::new().and_then(|job| job.assign(child).map(|()| job)).ok();
    ProcessTree { pid: child.id(), job }
}

impl ProcessTree {
    pub fn pid(&self) -> u32 {
        self.pid
    }

    /// Arrête le processus et tous ses descendants.
    pub fn kill(&self) -> io::Result<()> {
        match &self.job {
            Some(job) => job.terminate(),
            None => taskkill_tree(self.pid),
        }
    }

    /// À appeler quand le processus principal s'est terminé de lui-même : les
    /// descendants encore en vie (ex. `start notepad`) ne seront pas tués à la
    /// fermeture du job, comme s'ils avaient été lancés depuis un terminal.
    /// (Cargo fait de même avec le job qui encadre `cargo run`.)
    pub fn release(&self) {
        if let Some(job) = &self.job {
            let _ = job.set_limits(JOB_OBJECT_LIMIT_BREAKAWAY_OK);
        }
    }
}

/// Handle d'un Job Object, fermé automatiquement. Seul endroit du projet qui
/// appelle directement l'API Win32 : chaque bloc `unsafe` y est justifié.
struct JobObject(HANDLE);

// SAFETY: un handle désigne un objet du noyau, utilisable depuis n'importe quel
// thread ; les fonctions de job sont sûres en concurrence et le handle n'est
// fermé qu'une fois, dans `drop`.
unsafe impl Send for JobObject {}
unsafe impl Sync for JobObject {}

impl JobObject {
    fn new() -> io::Result<Self> {
        // SAFETY: deux pointeurs nuls sont permis (sécurité par défaut, job sans nom).
        let handle = unsafe { CreateJobObjectW(ptr::null(), ptr::null()) };
        if handle.is_null() {
            return Err(io::Error::last_os_error());
        }
        let job = Self(handle);
        // `BREAKAWAY_OK` : un programme qui demande explicitement à quitter le job
        // (`CREATE_BREAKAWAY_FROM_JOB`) le peut, au lieu d'échouer avec « accès refusé ».
        job.set_limits(JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_BREAKAWAY_OK)?;
        Ok(job)
    }

    fn set_limits(&self, flags: JOB_OBJECT_LIMIT) -> io::Result<()> {
        let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limits.BasicLimitInformation.LimitFlags = flags;
        let size = size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32;
        // SAFETY: `limits` est bien la structure attendue pour cette classe d'information,
        // de la taille annoncée, et vit jusqu'à la fin de l'appel.
        check(unsafe {
            SetInformationJobObject(self.0, JobObjectExtendedLimitInformation, (&raw const limits).cast(), size)
        })
    }

    fn assign(&self, child: &Child) -> io::Result<()> {
        // SAFETY: le handle du processus appartient à `child`, emprunté pendant l'appel.
        check(unsafe { AssignProcessToJobObject(self.0, child.as_raw_handle()) })
    }

    fn terminate(&self) -> io::Result<()> {
        // SAFETY: `self.0` est un handle de job valide jusqu'à `drop`.
        check(unsafe { TerminateJobObject(self.0, 1) })
    }
}

impl Drop for JobObject {
    fn drop(&mut self) {
        // SAFETY: handle obtenu de `CreateJobObjectW`, fermé une seule fois.
        unsafe { CloseHandle(self.0) };
    }
}

/// Les fonctions Win32 renvoient 0 en cas d'échec ; le détail est dans `GetLastError`.
fn check(result: BOOL) -> io::Result<()> {
    if result == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

/// Repli si le job n'a pas pu être créé : arrête le processus et ses descendants
/// retrouvés par leur processus parent.
fn taskkill_tree(pid: u32) -> io::Result<()> {
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

/// Explication lisible des refus de démarrage propres à Windows. Le message du
/// système est dans la langue de Windows et souvent obscur (« os error 740 »).
pub fn describe_start_error(error: &io::Error) -> Option<&'static str> {
    let code = u32::try_from(error.raw_os_error()?).ok()?;
    match code {
        ERROR_ELEVATION_REQUIRED => Some("it requires administrator rights"),
        ERROR_BAD_EXE_FORMAT | ERROR_EXE_MACHINE_TYPE_MISMATCH => {
            Some("it is not a valid program for this version of Windows")
        }
        ERROR_ACCESS_DISABLED_BY_POLICY => Some("it is blocked by a system policy"),
        _ => None,
    }
}

/// Commandes internes de `cmd.exe` : elles ne correspondent à aucun fichier.
const CMD_BUILTINS: &[&str] = &[
    "assoc", "break", "call", "cd", "chdir", "cls", "color", "copy", "date", "del", "dir", "echo", "endlocal",
    "erase", "exit", "for", "ftype", "goto", "if", "md", "mkdir", "mklink", "move", "path", "pause", "popd",
    "prompt", "pushd", "rd", "rem", "ren", "rename", "rmdir", "set", "setlocal", "shift", "start", "time",
    "title", "type", "ver", "verify", "vol",
];

/// Programme appelé en tête de la ligne de commande, s'il est introuvable.
///
/// `cmd /c` sort avec le code 1 quand la commande n'existe pas, comme pour
/// n'importe quel échec (le fameux 9009 reste interne à cmd). On cherche donc le
/// premier programme comme le ferait cmd : dossier de travail, puis PATH, avec
/// les extensions de PATHEXT. Seul le premier mot est examiné (`cd app && npm i`
/// commence par une commande interne : rien à conclure) ; une ligne qui dépend de
/// variables (`%PATH%`, `!x!`) est ignorée.
pub fn missing_program(command_line: &str, working_directory: &Path) -> Option<String> {
    let line = command_line.trim_start().trim_start_matches('@');
    let program = match line.strip_prefix('"') {
        Some(quoted) => quoted.split('"').next()?,
        None => line
            .split(|c: char| c.is_whitespace() || "&|<>()/,;=".contains(c))
            .next()?,
    };
    if program.is_empty() || program.contains(['%', '!']) || program.starts_with(':') || is_drive(program) {
        return None;
    }
    if is_builtin(program) {
        return None;
    }
    let search_path = std::env::join_paths(
        std::iter::once(working_directory.to_path_buf())
            .chain(std::env::var_os("PATH").iter().flat_map(std::env::split_paths)),
    )
    .ok()?;
    match which::which_in(program, Some(search_path), working_directory) {
        Ok(_) => None,
        Err(_) => Some(program.to_owned()),
    }
}

/// `echo`, mais aussi `echo.` ou `cd..` : cmd accepte une ponctuation collée à la commande interne.
fn is_builtin(program: &str) -> bool {
    let lower = program.to_ascii_lowercase();
    CMD_BUILTINS.iter().any(|builtin| {
        lower
            .strip_prefix(builtin)
            .is_some_and(|rest| rest.chars().next().is_none_or(|next| !next.is_ascii_alphanumeric()))
    })
}

/// `D:` : changement de lecteur.
fn is_drive(program: &str) -> bool {
    let bytes = program.as_bytes();
    bytes.len() == 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':'
}

/// Chemin complet d'un outil système. Sans chemin complet, Windows chercherait
/// d'abord dans le dossier de l'application, où un faux `cmd.exe` pourrait être déposé.
fn system32(program: &str) -> PathBuf {
    let root = std::env::var_os("SystemRoot").unwrap_or_else(|| OsString::from(r"C:\Windows"));
    PathBuf::from(root).join("System32").join(program)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader};
    use std::sync::mpsc;
    use std::thread;
    use std::time::{Duration, Instant};

    /// Démarre une commande dont la sortie est lue en continu ; chaque ligne arrive dans le canal.
    /// Le canal se ferme quand *tous* les processus qui partagent la sortie (enfants compris) sont morts.
    /// Lignes en octets bruts : la sortie de `ping` sur un Windows français n'est pas de l'UTF-8.
    fn start(command_line: &str) -> (Child, ProcessTree, mpsc::Receiver<Vec<u8>>) {
        let mut child = shell_command(command_line)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let tree = track_process_tree(&child);
        assert!(tree.job.is_some(), "the process should be in a job");
        let stdout = child.stdout.take().unwrap();
        let (lines_tx, lines_rx) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(stdout).split(b'\n').map_while(Result::ok) {
                let _ = lines_tx.send(line);
            }
        });
        (child, tree, lines_rx)
    }

    /// Attend la fermeture de la sortie, c'est-à-dire la mort de tous les processus.
    fn output_closes_within(lines: &mpsc::Receiver<Vec<u8>>, timeout: Duration) -> bool {
        let deadline = Instant::now() + timeout;
        loop {
            match lines.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
                Ok(_) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => return true,
                Err(mpsc::RecvTimeoutError::Timeout) => return false,
            }
        }
    }

    #[test]
    fn closing_the_job_kills_the_whole_tree_as_if_the_app_crashed() {
        // `ping` est un enfant de `cmd` et écrit une ligne par seconde pendant 30 s.
        let (mut child, tree, lines) = start("ping -n 30 127.0.0.1");
        lines.recv_timeout(Duration::from_secs(10)).unwrap();

        // Ce que fait Windows quand l'app disparaît : il ferme ses handles.
        drop(tree);

        assert!(output_closes_within(&lines, Duration::from_secs(5)), "ping survived the job");
        child.wait().unwrap();
    }

    #[test]
    fn a_released_job_leaves_detached_programs_running() {
        // `start /b` : `cmd` se termine tout de suite, `ping` continue en arrière-plan.
        let (mut child, tree, lines) = start("start /b ping -n 6 127.0.0.1");
        child.wait().unwrap();
        tree.release();
        drop(tree);

        thread::sleep(Duration::from_millis(300));
        while lines.try_recv().is_ok() {}
        // Une nouvelle ligne arrive après la fermeture du job : `ping` a survécu.
        assert!(lines.recv_timeout(Duration::from_secs(3)).is_ok(), "ping was killed with the job");
        assert!(output_closes_within(&lines, Duration::from_secs(10)));
    }

    #[test]
    fn finds_the_missing_program_at_the_start_of_a_command_line() {
        let dir = std::env::temp_dir().join("bootdeck-missing-program");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("local-script.bat"), "@echo off").unwrap();
        let missing = |line: &str| missing_program(line, &dir);

        assert_eq!(missing("notacommand123 --help").as_deref(), Some("notacommand123"));
        assert_eq!(missing("@notacommand123").as_deref(), Some("notacommand123"));
        assert_eq!(missing(r#""C:
ope	ool.exe" --flag"#).as_deref(), Some(r"C:
ope	ool.exe"));
        assert_eq!(missing("notacommand123&& echo done").as_deref(), Some("notacommand123"));

        // Trouvés : PATH (avec PATHEXT), dossier de travail, commandes internes.
        assert_eq!(missing("ping -n 1 127.0.0.1"), None);
        assert_eq!(missing("cmd.exe /c echo"), None);
        assert_eq!(missing("local-script --verbose"), None);
        assert_eq!(missing("echo hello"), None);
        assert_eq!(missing("ECHO. && cd.. && dir/w"), None);
        assert_eq!(missing("cd frontend && notacommand123"), None);

        // Impossible à savoir sans exécuter : on ne conclut rien.
        assert_eq!(missing(r"%LOCALAPPDATA%	ool.exe"), None);
        assert_eq!(missing("D: && dir"), None);
        assert_eq!(missing(""), None);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn describes_windows_specific_start_errors() {
        let describe = |code| describe_start_error(&io::Error::from_raw_os_error(code));
        assert_eq!(describe(740), Some("it requires administrator rights"));
        assert_eq!(describe(193), Some("it is not a valid program for this version of Windows"));
        assert_eq!(describe(2), None);
        assert_eq!(describe_start_error(&io::Error::other("no code")), None);
    }
}
