import { create } from "zustand";
import type { Preset } from "@/domain/preset/schema";
import { variablesUsedBy } from "@/domain/variables/variables";
import { launchStore } from "@/stores/launch-store";

/**
 * Point d'entrée de tous les boutons « Launch » et « Run this item only ».
 *
 * Si les items à lancer utilisent des variables, on demande d'abord leurs
 * valeurs (boîte de lancement) ; sinon on lance directement.
 */

interface LaunchRequest {
  presetId: string;
  /** Absent : tout le preset. */
  itemId?: string;
}

interface LaunchRequestState {
  request: LaunchRequest | null;
  /** Dernières valeurs saisies, par preset, pour pré-remplir la prochaine fois (session en cours). */
  lastInputs: Record<string, Record<string, string>>;
  open: (request: LaunchRequest) => void;
  close: () => void;
  remember: (presetId: string, inputs: Record<string, string>) => void;
}

export const useLaunchRequestStore = create<LaunchRequestState>()((set) => ({
  request: null,
  lastInputs: {},
  open: (request) => set({ request }),
  close: () => set({ request: null }),
  remember: (presetId, inputs) => set((state) => ({ lastInputs: { ...state.lastInputs, [presetId]: inputs } })),
}));

/** Items concernés : tous les items activés, ou l'item demandé (même désactivé). */
export function itemsToLaunch(preset: Preset, itemId?: string) {
  return itemId === undefined
    ? preset.items.filter((item) => item.enabled)
    : preset.items.filter((item) => item.id === itemId);
}

export function startLaunch(preset: Preset, itemId?: string): void {
  if (variablesUsedBy(itemsToLaunch(preset, itemId)).length > 0) {
    useLaunchRequestStore.getState().open({ presetId: preset.id, itemId });
    return;
  }
  const launch = launchStore.getState();
  void (itemId === undefined ? launch.launchPreset(preset) : launch.launchItem(preset, itemId));
}
