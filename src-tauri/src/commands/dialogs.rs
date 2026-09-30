//! Boîtes de dialogue natives pour choisir un dossier ou un programme.
//!
//! Le plugin `dialog` n'est utilisé que depuis Rust : aucune permission `dialog:*`
//! n'est accordée au JavaScript. Le front ne reçoit que le chemin choisi par
//! l'utilisateur, ou `null` s'il a annulé.

use tauri::{AppHandle, Runtime, WebviewWindow};
use tauri_plugin_dialog::{DialogExt, FileDialogBuilder, FilePath};

use crate::commands::launcher::home_dir;
use crate::errors::AppError;
use crate::system::paths::start_directory;

/// `start_in` : valeur actuelle du champ, pour ouvrir la boîte au bon endroit.
#[tauri::command]
pub async fn pick_folder<R: Runtime>(
    app: AppHandle<R>,
    window: WebviewWindow<R>,
    start_in: Option<String>,
) -> Result<Option<String>, AppError> {
    let dialog = dialog_builder(&app, &window, "Select a folder", start_in.as_deref())?;
    // Bloquant, mais sans risque : une commande `async` ne tourne pas sur le thread principal.
    selected_path(dialog.blocking_pick_folder())
}

#[tauri::command]
pub async fn pick_program<R: Runtime>(
    app: AppHandle<R>,
    window: WebviewWindow<R>,
    start_in: Option<String>,
) -> Result<Option<String>, AppError> {
    let dialog = dialog_builder(&app, &window, "Select a program", start_in.as_deref())?;
    #[cfg(windows)]
    let dialog = dialog.add_filter("Programs", &["exe", "cmd", "bat", "com"]);
    #[cfg(target_os = "macos")]
    let dialog = dialog.add_filter("Applications", &["app"]);
    selected_path(dialog.blocking_pick_file())
}

fn dialog_builder<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
    title: &str,
    start_in: Option<&str>,
) -> Result<FileDialogBuilder<R>, AppError> {
    let home = home_dir(app)?;
    Ok(app
        .dialog()
        .file()
        .set_title(title)
        // Rattachée à la fenêtre de l'app : la boîte est modale et s'affiche au-dessus.
        .set_parent(window)
        .set_directory(start_directory(start_in, &home)))
}

fn selected_path(selection: Option<FilePath>) -> Result<Option<String>, AppError> {
    selection
        .map(|file| {
            file.into_path()
                .map(|path| path.display().to_string())
                .map_err(|_| AppError::InvalidInput("the selected item is not a local path".into()))
        })
        .transpose()
}
