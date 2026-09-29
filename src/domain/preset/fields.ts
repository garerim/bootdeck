import { z } from "zod";

/**
 * Règles de validation réutilisables pour les champs d'un preset.
 *
 * Elles vérifient la *forme* d'une valeur, jamais l'état de la machine :
 * savoir si un dossier existe ou si un programme est installé se fait au
 * lancement, côté Rust. (Un disque externe peut être débranché aujourd'hui
 * et rebranché demain : le preset reste valide.)
 */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const WINDOWS_DRIVE_PATH = /^[a-zA-Z]:[\\/]/; // C:\Users\…  ou  D:/dev/…
const UNC_PATH = /^\\\\[^\\/]+[\\/]/; // \\serveur\partage\…
const POSIX_ABSOLUTE_PATH = /^\//; // /home/…
const HOME_PATH = /^~(?:[\\/]|$)/; // ~  ~/Projects  ~\Projects

export function hasControlChars(value: string): boolean {
  return CONTROL_CHARS.test(value);
}

/**
 * Chemin absolu (Windows, UNC ou POSIX) ou relatif au dossier personnel (`~`).
 * Un chemin relatif comme `Projects/app` est refusé : relatif à quoi ?
 * Le dossier courant de l'application n'a aucun sens pour l'utilisateur.
 */
export function isAbsoluteOrHomePath(value: string): boolean {
  return (
    WINDOWS_DRIVE_PATH.test(value) ||
    UNC_PATH.test(value) ||
    POSIX_ABSOLUTE_PATH.test(value) ||
    HOME_PATH.test(value)
  );
}

/** Seuls http et https sont autorisés : `javascript:`, `file:` ou des schémas
 *  exotiques peuvent déclencher des programmes via l'OS. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const displayName = (maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(maxLength, `Name must be at most ${maxLength} characters`);

export const absolutePath = z
  .string()
  .trim()
  .min(1, "Path is required")
  .max(4096, "Path is too long")
  .refine((value) => !hasControlChars(value), "Path contains invalid characters")
  .refine(isAbsoluteOrHomePath, "Use an absolute path (C:\\…, /…) or a path starting with ~");

/** Nom de programme présent dans le PATH (`code`, `wt.exe`) ou chemin absolu. */
export const programPath = z
  .string()
  .trim()
  .min(1, "Program is required")
  .max(4096, "Path is too long")
  .refine((value) => !hasControlChars(value), "Program contains invalid characters")
  .refine(
    (value) => !/[\\/]/.test(value) || isAbsoluteOrHomePath(value),
    "Use a program name (e.g. code) or an absolute path",
  );

export const programArgument = z
  .string()
  .max(4096, "Argument is too long")
  .refine((value) => !hasControlChars(value), "Argument contains invalid characters");

export const httpUrl = z
  .string()
  .trim()
  .min(1, "URL is required")
  .max(2048, "URL is too long")
  .refine(isHttpUrl, "Must be an http:// or https:// URL");

/** Une seule ligne : pas de retour à la ligne caché qui enchaînerait une
 *  deuxième commande invisible dans l'interface. */
export const shellCommand = z
  .string()
  .trim()
  .min(1, "Command is required")
  .max(2000, "Command is too long")
  .refine((value) => !hasControlChars(value), "Command must be a single line without control characters");
