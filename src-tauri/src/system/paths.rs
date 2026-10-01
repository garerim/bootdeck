//! Chemins saisis par l'utilisateur : expansion de `~` et contrôles communs à tous les OS.

use std::path::{Path, PathBuf};

use crate::errors::AppError;

/// Remplace un `~` initial par le dossier personnel : `~`, `~/Projects`, `~\Projects`.
pub fn expand_home(input: &str, home: &Path) -> PathBuf {
    if input == "~" {
        return home.to_path_buf();
    }
    match input.strip_prefix("~/").or_else(|| input.strip_prefix("~\\")) {
        // Découpe sur les deux séparateurs pour obtenir un chemin propre à l'OS.
        Some(rest) => rest
            .split(['/', '\\'])
            .filter(|segment| !segment.is_empty())
            .fold(home.to_path_buf(), |path, segment| path.join(segment)),
        None => PathBuf::from(input),
    }
}

/// Chemin absolu après expansion de `~`. Un chemin relatif est refusé : il
/// dépendrait du dossier courant de l'application, qui n'a aucun sens pour l'utilisateur.
pub fn absolute_path(input: &str, home: &Path) -> Result<PathBuf, AppError> {
    let input = input.trim();
    if input.is_empty() {
        return Err(AppError::InvalidInput("path is empty".into()));
    }
    if input.chars().any(char::is_control) {
        return Err(AppError::InvalidInput("path contains control characters".into()));
    }
    let path = expand_home(input, home);
    if path.is_absolute() {
        Ok(path)
    } else {
        Err(AppError::InvalidInput(format!("path must be absolute: {input}")))
    }
}

/// Dossier où ouvrir une boîte de dialogue : celui déjà saisi dans le champ s'il
/// existe (ou le dossier qui contient le fichier saisi), sinon le dossier personnel.
pub fn start_directory(current_value: Option<&str>, home: &Path) -> PathBuf {
    let Some(path) = current_value.and_then(|value| absolute_path(value, home).ok()) else {
        return home.to_path_buf();
    };
    if path.is_dir() {
        return path;
    }
    match path.parent() {
        Some(parent) if parent.is_dir() => parent.to_path_buf(),
        _ => home.to_path_buf(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn home() -> PathBuf {
        std::env::temp_dir().join("home")
    }

    #[test]
    fn expands_a_leading_tilde_with_either_separator() {
        let home = home();
        assert_eq!(expand_home("~", &home), home);
        assert_eq!(expand_home("~/Projects/my-saas", &home), home.join("Projects").join("my-saas"));
        assert_eq!(expand_home("~\\Projects\\my-saas", &home), home.join("Projects").join("my-saas"));
    }

    #[test]
    fn leaves_other_paths_untouched() {
        let home = home();
        assert_eq!(expand_home("~user/projects", &home), PathBuf::from("~user/projects"));
        assert_eq!(expand_home("projects/~", &home), PathBuf::from("projects/~"));
    }

    #[test]
    fn refuses_relative_paths() {
        for input in ["Projects/app", "./app", "..\\secrets", "C:relative"] {
            assert!(
                matches!(absolute_path(input, &home()), Err(AppError::InvalidInput(_))),
                "{input} should be refused"
            );
        }
    }

    #[test]
    fn refuses_empty_paths_and_control_characters() {
        assert!(absolute_path("   ", &home()).is_err());
        assert!(absolute_path("~/app\n", &home()).is_ok(), "surrounding whitespace is trimmed");
        assert!(absolute_path("~/a\u{0}pp", &home()).is_err());
    }

    #[test]
    fn accepts_home_relative_paths() {
        assert_eq!(absolute_path(" ~/app ", &home()).unwrap(), home().join("app"));
    }

    #[test]
    fn dialogs_start_in_the_folder_already_entered() {
        let root = std::env::temp_dir().join(format!("startdeck-start-dir-{}", std::process::id()));
        let project = root.join("project");
        std::fs::create_dir_all(&project).unwrap();
        std::fs::write(project.join("app.exe"), "").unwrap();

        assert_eq!(start_directory(Some("~/project"), &root), project, "existing folder");
        assert_eq!(start_directory(Some("~/project/app.exe"), &root), project, "folder of a file");
        assert_eq!(start_directory(Some("~/project/missing/deeper"), &root), root, "missing: home");
        assert_eq!(start_directory(Some("code"), &root), root, "program name: home");
        assert_eq!(start_directory(None, &root), root, "empty field: home");

        let _ = std::fs::remove_dir_all(&root);
    }
}
