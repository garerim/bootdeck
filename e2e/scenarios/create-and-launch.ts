import { expect, type Page } from "@playwright/test";

export interface LaunchTargets {
  /** Page web ouverte par l'item URL. */
  url: string;
  /** Dossier ouvert par l'item Folder. */
  folder: string;
}

export const PRESET_NAME = "E2E preset";

/**
 * Parcours principal : créer un preset → ajouter une URL → ajouter un dossier →
 * enregistrer → lancer → voir le succès. Le même parcours tourne dans le navigateur
 * (système simulé) et dans l'application desktop (système réel).
 */
export async function createAndLaunchPreset(page: Page, targets: LaunchTargets): Promise<void> {
  await page.getByRole("button", { name: "Create preset" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "New preset" })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill(PRESET_NAME);

  // Premier item : depuis les types proposés quand le preset est vide.
  await page.getByRole("button", { name: /^URL/ }).click();
  const urlItem = page.getByRole("group", { name: "Item 1: URL" });
  await urlItem.getByLabel("Name", { exact: true }).fill("Local page");
  await urlItem.getByLabel("URL", { exact: true }).fill(targets.url);

  // Deuxième item : depuis le menu « Add item ».
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByRole("menuitem", { name: /^Folder/ }).click();
  const folderItem = page.getByRole("group", { name: "Item 2: Folder" });
  await folderItem.getByLabel("Name", { exact: true }).fill("Project folder");
  // `exact` : dans l'app desktop, le bouton « Browse for a folder » porte aussi ce mot.
  await folderItem.getByLabel("Folder", { exact: true }).fill(targets.folder);

  await page.getByRole("button", { name: "Create preset" }).click();
  await expect(page.getByRole("heading", { level: 1, name: PRESET_NAME })).toBeVisible();
  await expect(page.getByText(`Created “${PRESET_NAME}”`)).toBeVisible();

  await page.getByRole("button", { name: "Launch", exact: true }).click();

  // Succès : bilan du lancement et statut de chaque item.
  await expect(page.getByRole("status").filter({ hasText: "launched" })).toContainText("2/2 launched");
  const rows = page.getByRole("list").getByRole("listitem");
  await expect(rows.filter({ hasText: "Local page" })).toContainText("Opened");
  await expect(rows.filter({ hasText: "Project folder" })).toContainText("Opened");
}
