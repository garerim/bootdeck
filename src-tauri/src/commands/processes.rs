//! Commandes des processus gérés.

use tauri::ipc::Channel;
use tauri::{AppHandle, Runtime, State};

use crate::commands::launcher::home_dir;
use crate::errors::AppError;
use crate::models::{ExecuteCommandRequest, ProcessEvent, ProcessId};
use crate::services::launcher;
use crate::services::processes::ProcessRegistry;
use crate::system;

/// Démarre la commande dans le shell du système et renvoie aussitôt son identifiant.
/// La sortie et le code de fin arrivent ensuite par `on_event` (un `Channel` Tauri,
/// propre à cet appel et qui préserve l'ordre des messages).
#[tauri::command]
pub async fn execute_command<R: Runtime>(
    app: AppHandle<R>,
    registry: State<'_, ProcessRegistry>,
    request: ExecuteCommandRequest,
    on_event: Channel<ProcessEvent>,
) -> Result<ProcessId, AppError> {
    let command_line = launcher::validate_command_line(&request.command)?;
    let home = home_dir(&app)?;
    let working_directory = launcher::resolve_working_directory(request.working_directory.as_deref(), &home)?;

    let mut command = system::shell_command(command_line);
    command.current_dir(&working_directory);
    let command_line = command_line.to_owned();
    registry.spawn(command, move |event| {
        // En cas d'échec seulement : le programme appelé existait-il ? Sert à
        // expliquer l'échec, jamais à empêcher une commande de s'exécuter.
        let event = match event {
            ProcessEvent::Exited { code: Some(code), .. } if code != 0 => ProcessEvent::Exited {
                code: Some(code),
                missing_program: system::missing_program(&command_line, &working_directory),
            },
            event => event,
        };
        // Si la fenêtre a été rechargée, le canal est fermé : le processus continue.
        let _ = on_event.send(event);
    })
}

#[tauri::command]
pub async fn stop_process(registry: State<'_, ProcessRegistry>, process_id: ProcessId) -> Result<(), AppError> {
    registry.stop(process_id)
}
