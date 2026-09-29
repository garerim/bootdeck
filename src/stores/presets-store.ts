import { create } from "zustand";
import { demoPresets } from "@/domain/preset/fixtures";
import { duplicatePreset } from "@/domain/preset/operations";
import type { Preset } from "@/domain/preset/schema";

/**
 * Presets en mémoire.
 *
 * Phase 2 : initialisés avec les données de démonstration et perdus au
 * rechargement. La Phase 4 branchera le chargement et la sauvegarde sur disque.
 */
interface PresetsState {
  presets: Preset[];
  /** Crée le preset s'il n'existe pas, sinon le remplace. */
  save: (preset: Preset) => void;
  remove: (id: string) => void;
  /** Insère la copie juste après l'original et la renvoie. */
  duplicate: (id: string) => Preset | undefined;
}

export const usePresetsStore = create<PresetsState>()((set, get) => ({
  presets: structuredClone(demoPresets),

  save: (preset) =>
    set(({ presets }) => ({
      presets: presets.some((existing) => existing.id === preset.id)
        ? presets.map((existing) => (existing.id === preset.id ? preset : existing))
        : [...presets, preset],
    })),

  remove: (id) => set(({ presets }) => ({ presets: presets.filter((preset) => preset.id !== id) })),

  duplicate: (id) => {
    const presets = get().presets;
    const index = presets.findIndex((preset) => preset.id === id);
    const original = presets[index];
    if (!original) return undefined;

    const copy = duplicatePreset(original, { now: new Date(), newId: () => crypto.randomUUID() });
    set({ presets: [...presets.slice(0, index + 1), copy, ...presets.slice(index + 1)] });
    return copy;
  },
}));
