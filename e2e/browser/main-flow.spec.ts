import { expect, test } from "@playwright/test";
import { createAndLaunchPreset } from "../scenarios/create-and-launch";

// Navigateur : système simulé, rien n'est réellement ouvert.
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("créer un preset avec une URL et un dossier, l'enregistrer puis le lancer", async ({ page }) => {
  await createAndLaunchPreset(page, { url: "https://example.com/docs", folder: "~/Projects/my-app" });
});

test("un item en échec propose de le corriger dans l'éditeur", async ({ page }) => {
  await page.getByRole("button", { name: "Create preset" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Broken server");
  await page.getByRole("button", { name: /^Command/ }).click();
  const commandItem = page.getByRole("group", { name: "Item 1: Command" });
  await commandItem.getByLabel("Name", { exact: true }).fill("Dev server");
  // Le système simulé fait échouer toute commande contenant « fail ».
  await commandItem.getByLabel("Command", { exact: true }).fill("npm run fail");
  await page.getByRole("button", { name: "Create preset" }).click();

  await page.getByRole("button", { name: "Launch", exact: true }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Dev server" });
  await expect(row).toContainText("Command exited with code 1.");
  await expect(row).toContainText("Failed");

  await row.getByRole("button", { name: "Edit item" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit preset" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Item 1: Command" }).getByLabel("Name", { exact: true })).toBeFocused();
});

test("quitter l'éditeur avec des modifications demande confirmation, Ctrl+S enregistre", async ({ page }) => {
  await page.getByRole("button", { name: "Dev SaaS" }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  const name = page.getByLabel("Name", { exact: true }).first();
  await name.fill("Dev SaaS (edited)");

  await page.keyboard.press("Escape");
  const dialog = page.getByRole("alertdialog", { name: "Discard unsaved changes?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(dialog).toBeHidden();
  await expect(name).toBeFocused();

  await page.keyboard.press("Control+s");
  await expect(page.getByRole("heading", { level: 1, name: "Dev SaaS (edited)" })).toBeVisible();
  await expect(page.getByText("Changes saved")).toBeVisible();
});
