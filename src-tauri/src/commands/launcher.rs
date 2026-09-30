//! Commandes d'ouverture : URL, dossier, application.
//!
//! Les commandes sont génériques sur le `Runtime` de Tauri : l'app utilise la vraie
//! WebView (Wry), les tests d'IPC le runtime simulé (`tauri::test`).

use std::path::PathBuf;

use tauri::{AppHandle, Manager, Runtime};

use crate::errors::AppError;
use crate::models::LaunchApplicationRequest;
use crate::services::launcher;
use crate::system;

#[tauri::command]
pub async fn open_url(url: String) -> Result<(), AppError> {
    let url = launcher::validate_url(&url)?;
    system::open_with_default_app(url.as_str()).map_err(|source| AppError::Open {
        target: url.to_string(),
        source,
    })
}

#[tauri::command]
pub async fn open_folder<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), AppError> {
    let folder = launcher::resolve_folder(&path, &home_dir(&app)?)?;
    system::open_with_default_app(&folder).map_err(|source| AppError::Open {
        target: folder.display().to_string(),
        source,
    })
}

#[tauri::command]
pub async fn launch_application<R: Runtime>(app: AppHandle<R>, request: LaunchApplicationRequest) -> Result<(), AppError> {
    launcher::launch_application(&request, &home_dir(&app)?)
}

pub fn home_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, AppError> {
    app.path()
        .home_dir()
        .map_err(|error| AppError::not_found("Home folder", error))
}
