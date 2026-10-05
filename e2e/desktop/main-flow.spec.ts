import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { expect, test } from "@playwright/test";
import { createAndLaunchPreset, PRESET_NAME } from "../scenarios/create-and-launch";
import {
  closeExplorerWindows,
  explorerWindowsShowing,
  launchDesktopApp,
  removeDesktopAppData,
  type DesktopApp,
} from "./desktop-app";

/**
 * Application réelle : le lancement ouvre vraiment la page dans le navigateur par
 * défaut et le dossier dans l'Explorateur. Le test le vérifie de l'extérieur : le
 * navigateur demande la page à un petit serveur local, et l'Explorateur affiche le
 * dossier (fenêtre refermée à la fin). L'onglet du navigateur, lui, reste ouvert.
 */
test.skip(process.platform !== "win32", "desktop E2E runs on Windows (WebView2)");

let app: DesktopApp;
let server: Server;
let pageRequests: string[];
let folder: string;

test.beforeEach(async () => {
  pageRequests = [];
  server = createServer((request, response) => {
    pageRequests.push(request.url ?? "");
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end("<title>Bootdeck E2E</title><p>Opened by the end-to-end test. You can close this tab.</p>");
  });
  await new Promise<void>((listening) => server.listen(0, "127.0.0.1", listening));
  folder = mkdtempSync(join(tmpdir(), "bootdeck-e2e-"));
  app = await launchDesktopApp();
});

test.afterEach(async () => {
  await app.close();
  removeDesktopAppData();
  closeExplorerWindows(basename(folder));
  rmSync(folder, { recursive: true, force: true });
  // L'onglet ouvert dans le navigateur garde sa connexion : sans ça, `close` l'attendrait.
  server.closeAllConnections();
  await new Promise((closed) => server.close(closed));
});

test("créer un preset, l'enregistrer et le lancer ouvre réellement la page et le dossier", async () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server is not listening");
  const url = `http://127.0.0.1:${address.port}/bootdeck-e2e`;

  await createAndLaunchPreset(app.page, { url, folder });

  // Effets réels, observés hors de l'application.
  await expect.poll(() => pageRequests, { timeout: 20_000 }).toContain("/bootdeck-e2e");
  await expect.poll(() => explorerWindowsShowing(basename(folder)), { timeout: 20_000 }).toBeGreaterThan(0);

  // Enregistré sur le disque : le preset est toujours là après un redémarrage de l'app.
  await app.close();
  app = await launchDesktopApp({ resetData: false });
  await expect(app.page.getByRole("button", { name: PRESET_NAME })).toBeVisible();
});
