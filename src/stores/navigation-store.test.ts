import { beforeEach, describe, expect, it } from "vitest";
import { useNavigationStore } from "@/stores/navigation-store";

const store = useNavigationStore;
const editor = { name: "preset-edit", presetId: "p1" } as const;

describe("navigation — modifications non enregistrées", () => {
  beforeEach(() => {
    store.setState({ route: editor, unsavedChanges: false, pendingLeave: null });
  });

  it("navigue directement quand rien n'est en cours de modification", () => {
    store.getState().navigate({ name: "presets" });
    expect(store.getState().route).toEqual({ name: "presets" });
  });

  it("retient la navigation tant que l'utilisateur n'a pas confirmé", () => {
    store.getState().setUnsavedChanges(true);
    store.getState().navigate({ name: "settings" });
    expect(store.getState()).toMatchObject({
      route: editor,
      pendingLeave: { kind: "navigate", route: { name: "settings" } },
    });

    store.getState().cancelLeave();
    expect(store.getState()).toMatchObject({ route: editor, pendingLeave: null, unsavedChanges: true });

    store.getState().navigate({ name: "settings" });
    store.getState().confirmLeave();
    expect(store.getState()).toMatchObject({ route: { name: "settings" }, pendingLeave: null, unsavedChanges: false });
  });

  it("laisse passer une navigation forcée (après enregistrement) et ignore l'écran déjà affiché", () => {
    store.getState().setUnsavedChanges(true);
    store.getState().navigate(editor);
    expect(store.getState().pendingLeave).toBeNull();

    store.getState().navigate({ name: "preset-detail", presetId: "p1" }, { force: true });
    expect(store.getState()).toMatchObject({ route: { name: "preset-detail", presetId: "p1" }, unsavedChanges: false });
  });

  it("retient la fermeture de la fenêtre et la renvoie à l'appelant une fois confirmée", () => {
    store.getState().requestClose();
    expect(store.getState().pendingLeave).toBeNull(); // rien à perdre : pas de question

    store.getState().setUnsavedChanges(true);
    store.getState().requestClose();
    expect(store.getState().pendingLeave).toEqual({ kind: "close-window" });

    expect(store.getState().confirmLeave()).toEqual({ kind: "close-window" });
    expect(store.getState()).toMatchObject({ route: editor, pendingLeave: null, unsavedChanges: false });
    expect(store.getState().confirmLeave()).toBeNull();
  });
});
