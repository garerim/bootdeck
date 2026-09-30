import { beforeEach, describe, expect, it } from "vitest";
import { useNavigationStore } from "@/stores/navigation-store";

const store = useNavigationStore;
const editor = { name: "preset-edit", presetId: "p1" } as const;

describe("navigation — modifications non enregistrées", () => {
  beforeEach(() => {
    store.setState({ route: editor, unsavedChanges: false, pendingRoute: null });
  });

  it("navigue directement quand rien n'est en cours de modification", () => {
    store.getState().navigate({ name: "presets" });
    expect(store.getState().route).toEqual({ name: "presets" });
  });

  it("retient la navigation tant que l'utilisateur n'a pas confirmé", () => {
    store.getState().setUnsavedChanges(true);
    store.getState().navigate({ name: "settings" });
    expect(store.getState()).toMatchObject({ route: editor, pendingRoute: { name: "settings" } });

    store.getState().cancelNavigation();
    expect(store.getState()).toMatchObject({ route: editor, pendingRoute: null, unsavedChanges: true });

    store.getState().navigate({ name: "settings" });
    store.getState().confirmNavigation();
    expect(store.getState()).toMatchObject({ route: { name: "settings" }, pendingRoute: null, unsavedChanges: false });
  });

  it("laisse passer une navigation forcée (après enregistrement) et ignore l'écran déjà affiché", () => {
    store.getState().setUnsavedChanges(true);
    store.getState().navigate(editor);
    expect(store.getState().pendingRoute).toBeNull();

    store.getState().navigate({ name: "preset-detail", presetId: "p1" }, { force: true });
    expect(store.getState()).toMatchObject({ route: { name: "preset-detail", presetId: "p1" }, unsavedChanges: false });
  });
});
