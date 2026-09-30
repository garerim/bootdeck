import { defineConfig } from "@playwright/test";

/**
 * Tests de bout en bout, en deux projets :
 * - `browser` : l'interface dans Edge (Chromium hors Windows), avec le système simulé.
 *   Rapide, sans effet de bord, sur tout OS : `npm run test:e2e`.
 * - `desktop` : la vraie application Tauri, pilotée à travers sa WebView2 (Windows).
 *   `npm run test:e2e:desktop` compile d'abord une variante isolée de l'app.
 */
export default defineConfig({
  testDir: "e2e",
  // L'app desktop est à instance unique : un test à la fois.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { trace: "retain-on-failure" },
  projects: [
    {
      name: "browser",
      testDir: "e2e/browser",
      use: {
        baseURL: "http://localhost:1420",
        // Edge est déjà installé sur Windows : aucun navigateur à télécharger.
        channel: process.platform === "win32" ? "msedge" : undefined,
      },
    },
    { name: "desktop", testDir: "e2e/desktop" },
  ],
  webServer: {
    command: "npm run dev:web",
    url: "http://localhost:1420",
    // Réutilise le serveur de `npm run dev` s'il tourne déjà.
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
