//! Validation des demandes du front et lancement des applications.
//!
//! Tout ce qui arrive par l'IPC est revalidé ici, même si le front l'a déjà
//! vérifié avec Zod : Rust ne fait jamais confiance à l'autre côté de la frontière.

use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::thread;

use tauri::Url;

use crate::errors::AppError;
use crate::models::LaunchApplicationRequest;
use crate::system;
use crate::system::paths::absolute_path;

const MAX_URL_LENGTH: usize = 2048;
const MAX_COMMAND_LENGTH: usize = 2000;
const MAX_ARGUMENTS: usize = 64;
const MAX_ARGUMENT_LENGTH: usize = 4096;

/// Seuls http et https sont acceptés : d'autres schémas (`file:`, `ms-msdt:`…)
/// peuvent faire lancer des programmes par le système.
pub fn validate_url(input: &str) -> Result<Url, AppError> {
    let input = input.trim();
    if input.len() > MAX_URL_LENGTH {
        return Err(AppError::InvalidInput("URL is too long".into()));
    }
    let url = Url::parse(input).map_err(|error| AppError::InvalidInput(format!("invalid URL ({error})")))?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        scheme => Err(AppError::InvalidInput(format!("URL scheme \"{scheme}\" is not allowed"))),
    }
}

/// Une seule ligne, sans caractère de contrôle : rien ne doit être caché à l'utilisateur.
pub fn validate_command_line(input: &str) -> Result<&str, AppError> {
    let command = input.trim();
    if command.is_empty() {
        return Err(AppError::InvalidInput("command is empty".into()));
    }
    if command.len() > MAX_COMMAND_LENGTH {
        return Err(AppError::InvalidInput("command is too long".into()));
    }
    if command.chars().any(char::is_control) {
        return Err(AppError::InvalidInput(
            "command must be a single line without control characters".into(),
        ));
    }
    Ok(command)
}

pub fn validate_arguments(args: &[String]) -> Result<(), AppError> {
    if args.len() > MAX_ARGUMENTS {
        return Err(AppError::InvalidInput("too many arguments".into()));
    }
    for arg in args {
        if arg.len() > MAX_ARGUMENT_LENGTH {
            return Err(AppError::InvalidInput("argument is too long".into()));
        }
        if arg.chars().any(char::is_control) {
            return Err(AppError::InvalidInput("argument contains control characters".into()));
        }
    }
    Ok(())
}

/// Dossier existant, désigné par un chemin absolu ou commençant par `~`.
pub fn resolve_folder(input: &str, home: &Path) -> Result<PathBuf, AppError> {
    let path = absolute_path(input, home)?;
    if !path.exists() {
        return Err(AppError::not_found("Folder", path.display()));
    }
    if !path.is_dir() {
        return Err(AppError::InvalidInput(format!("not a folder: {}", path.display())));
    }
    Ok(path)
}

/// Dossier de travail demandé, ou le dossier personnel par défaut.
pub fn resolve_working_directory(input: Option<&str>, home: &Path) -> Result<PathBuf, AppError> {
    match input.map(str::trim).filter(|value| !value.is_empty()) {
        None => Ok(home.to_path_buf()),
        Some(value) => resolve_folder(value, home).map_err(|error| match error {
            AppError::NotFound { target, .. } => AppError::NotFound {
                what: "Working directory",
                target,
            },
            other => other,
        }),
    }
}

/// Programme à lancer :
/// - un nom sans séparateur (`code`, `wt`) est cherché dans le PATH, avec les
///   règles Windows (PATHEXT : `code` → `code.cmd`, alias d'application comme `wt.exe`) ;
/// - sinon, un chemin absolu (ou `~`) qui doit exister.
pub fn resolve_program(input: &str, home: &Path, search_path: Option<&OsStr>) -> Result<PathBuf, AppError> {
    let input = input.trim();
    if input.is_empty() {
        return Err(AppError::InvalidInput("program is empty".into()));
    }

    if !input.contains(['/', '\\']) {
        return which::which_in(input, search_path, home)
            .map_err(|_| AppError::not_found("Program", format!("{input} (not in PATH)")));
    }

    let path = absolute_path(input, home)?;
    if path.exists() {
        Ok(path)
    } else {
        Err(AppError::not_found("Program", path.display()))
    }
}

/// Lance une application détachée : l'app n'attend pas sa fin et ne lit pas sa sortie.
/// Réussir signifie « le système a démarré le processus », pas « la fenêtre est visible ».
pub fn launch_application(request: &LaunchApplicationRequest, home: &Path) -> Result<(), AppError> {
    let search_path = std::env::var_os("PATH");
    let program = resolve_program(&request.path, home, search_path.as_deref())?;
    validate_arguments(&request.args)?;
    let working_directory = resolve_working_directory(request.working_directory.as_deref(), home)?;

    let mut command = system::application_command(&program, &request.args);
    command
        .current_dir(&working_directory)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    let mut child = command
        .spawn()
        .map_err(|error| AppError::start(&program, error))?;

    // Récupère le code de sortie quand l'application se termine, pour qu'elle ne
    // reste pas en « zombie » sous Unix. Le thread dort pendant ce temps.
    thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(test_name: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "workspace-presets-launcher-{test_name}-{}",
                std::process::id()
            ));
            let _ = fs::remove_dir_all(&path);
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn accepts_http_and_https_urls() {
        for url in ["http://localhost:3000", "https://supabase.com/dashboard?tab=a&b=c"] {
            assert!(validate_url(url).is_ok(), "{url} should be accepted");
        }
    }

    #[test]
    fn refuses_other_url_schemes_and_relative_urls() {
        for url in [
            "javascript:alert(1)",
            "file:///C:/Windows/System32/calc.exe",
            "ms-msdt:/id PCWDiagnostic",
            "ftp://example.com",
            "example.com",
            "",
        ] {
            assert!(
                matches!(validate_url(url), Err(AppError::InvalidInput(_))),
                "{url} should be refused"
            );
        }
    }

    #[test]
    fn validates_command_lines() {
        assert_eq!(validate_command_line("  npm run dev  ").unwrap(), "npm run dev");
        for command in ["", "   ", "npm run dev\nshutdown /s", "a\u{0}b"] {
            assert!(validate_command_line(command).is_err(), "{command:?} should be refused");
        }
        assert!(validate_command_line(&"x".repeat(MAX_COMMAND_LENGTH + 1)).is_err());
    }

    #[test]
    fn validates_arguments() {
        assert!(validate_arguments(&["-d".into(), ".".into()]).is_ok());
        assert!(validate_arguments(&["line\nbreak".into()]).is_err());
        assert!(validate_arguments(&vec![String::new(); MAX_ARGUMENTS + 1]).is_err());
    }

    #[test]
    fn resolves_an_existing_folder_including_with_tilde() {
        let dir = TempDir::new("folder");
        fs::create_dir_all(dir.0.join("project")).unwrap();
        assert_eq!(resolve_folder("~/project", &dir.0).unwrap(), dir.0.join("project"));
    }

    #[test]
    fn reports_a_missing_folder_or_a_file() {
        let dir = TempDir::new("missing-folder");
        fs::write(dir.0.join("file.txt"), "x").unwrap();
        assert!(matches!(
            resolve_folder("~/missing", &dir.0),
            Err(AppError::NotFound { what: "Folder", .. })
        ));
        assert!(matches!(resolve_folder("~/file.txt", &dir.0), Err(AppError::InvalidInput(_))));
    }

    #[test]
    fn working_directory_defaults_to_home_and_names_itself_in_errors() {
        let dir = TempDir::new("working-directory");
        assert_eq!(resolve_working_directory(None, &dir.0).unwrap(), dir.0);
        assert_eq!(resolve_working_directory(Some("  "), &dir.0).unwrap(), dir.0);
        assert!(matches!(
            resolve_working_directory(Some("~/missing"), &dir.0),
            Err(AppError::NotFound { what: "Working directory", .. })
        ));
    }

    #[test]
    fn finds_a_program_by_name_in_the_search_path() {
        let dir = TempDir::new("program-in-path");
        #[cfg(windows)]
        let expected = {
            // `tool` doit être trouvé sous la forme `tool.cmd` (règles PATHEXT).
            let file = dir.0.join("tool.cmd");
            fs::write(&file, "@echo off").unwrap();
            file
        };
        #[cfg(unix)]
        let expected = {
            use std::os::unix::fs::PermissionsExt;
            let file = dir.0.join("tool");
            fs::write(&file, "#!/bin/sh").unwrap();
            fs::set_permissions(&file, fs::Permissions::from_mode(0o755)).unwrap();
            file
        };

        let found = resolve_program("tool", &dir.0, Some(dir.0.as_os_str())).unwrap();
        assert_eq!(found.to_string_lossy().to_lowercase(), expected.to_string_lossy().to_lowercase());
        assert!(matches!(
            resolve_program("missing-tool", &dir.0, Some(dir.0.as_os_str())),
            Err(AppError::NotFound { what: "Program", .. })
        ));
    }

    #[test]
    fn resolves_programs_given_as_paths() {
        let dir = TempDir::new("program-path");
        let file = dir.0.join("app.exe");
        fs::write(&file, "").unwrap();

        assert_eq!(resolve_program("~/app.exe", &dir.0, None).unwrap(), file);
        assert!(matches!(
            resolve_program("~/missing.exe", &dir.0, None),
            Err(AppError::NotFound { .. })
        ));
        assert!(matches!(
            resolve_program("bin/app.exe", &dir.0, None),
            Err(AppError::InvalidInput(_))
        ));
    }
}
