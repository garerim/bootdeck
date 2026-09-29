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
}
