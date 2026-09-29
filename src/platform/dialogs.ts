import { z } from "zod";
import { isDesktop } from "@/platform/runtime";
import { invokeCommand } from "@/platform/tauri/invoke";

/** Faux dans un navigateur : les boîtes de dialogue natives n'y existent pas. */
export function canPickPaths(): boolean {
  return isDesktop();
}

const SelectionSchema = z.string().nullable();

/**
 * Ouvre le sélecteur de dossier natif du système.
 * `startIn` : valeur actuelle du champ, pour ouvrir la boîte au bon endroit.
 * Renvoie `null` si l'utilisateur annule.
 */
export function pickFolder(startIn?: string): Promise<string | null> {
  return invokeCommand("pick_folder", { startIn: startIn || undefined }, SelectionSchema);
}

/** Ouvre le sélecteur de fichier natif, limité aux programmes (.exe, .cmd… sous Windows). */
export function pickProgram(startIn?: string): Promise<string | null> {
  return invokeCommand("pick_program", { startIn: startIn || undefined }, SelectionSchema);
}
