/**
 * Port vers le système : ce dont le lancement a besoin, sans savoir comment
 * c'est fait. Implémentations : Tauri (commandes Rust) et simulation (navigateur, tests).
 *
 * Le domaine ne dépend que de cette interface : il ignore Tauri, Windows ou macOS.
 */

/** Identifiant attribué par le système à un processus lancé (pas un PID de l'OS). */
export type ProcessId = number;

export type ProcessEvent =
  | { type: "stdout"; line: string }
  | { type: "stderr"; line: string }
  /** `code` vaut `null` si le processus a été tué par un signal (Unix). */
  | { type: "exited"; code: number | null };

export interface LaunchApplicationRequest {
  path: string;
  args: string[];
  workingDirectory?: string;
}

export interface ExecuteCommandRequest {
  command: string;
  workingDirectory?: string;
}

export interface SystemAdapter {
  openUrl(url: string): Promise<void>;
  openFolder(path: string): Promise<void>;
  /** Réussit quand le programme a démarré, pas quand sa fenêtre est visible. */
  launchApplication(request: LaunchApplicationRequest): Promise<void>;
  /** Démarre la commande et renvoie son identifiant ; la suite arrive par `onEvent`. */
  executeCommand(request: ExecuteCommandRequest, onEvent: (event: ProcessEvent) => void): Promise<ProcessId>;
  /** Arrête le processus et ses descendants. Sans effet s'il est déjà terminé. */
  stopProcess(processId: ProcessId): Promise<void>;
}
