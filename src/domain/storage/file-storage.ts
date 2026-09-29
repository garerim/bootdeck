/**
 * Port de stockage d'un fichier de données (presets, sessions) : ce dont le
 * domaine a besoin, sans savoir comment c'est fait.
 * Implémentations : Tauri (fichier sur disque, via Rust) et mémoire (navigateur, tests).
 */
export interface FileStorage {
  /** Lit le fichier. `content` vaut `null` s'il n'existe pas encore. */
  read(): Promise<{ path: string; content: string | null }>;
  /** Remplace le contenu du fichier. */
  write(content: string): Promise<void>;
  /** Met le fichier actuel de côté et renvoie le chemin de la copie. */
  backup(): Promise<string>;
}
