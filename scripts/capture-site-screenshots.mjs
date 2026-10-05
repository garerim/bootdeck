// Captures de l'application pour le site web (dépôt séparé) :
//   npm run screenshots                          → ../bootdeck-website/public/screenshots
//   npm run screenshots -- <dossier de sortie>
//
// Source : l'aperçu navigateur de l'app (`npm run dev:web`, démarré si besoin), avec son
// système simulé et ses presets de démonstration : rien n'est réellement lancé. Thème sombre,
// fenêtre 1280×800 rendue à 2×, puis encodage WebP en plusieurs largeurs par le navigateur
// lui-même (canvas) : aucune dépendance d'image à installer.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, process.argv[2] ?? "../bootdeck-website/public/screenshots");
const APP_URL = "http://localhost:1420/";
const WIDTHS = [1280, 1920, 2560];

async function isUp() {
  try {
    return (await fetch(APP_URL)).ok;
  } catch {
    return false;
  }
}

/** Démarre l'aperçu de l'app s'il ne tourne pas déjà ; renvoie de quoi l'arrêter. */
async function ensureAppPreview() {
  if (await isUp()) return () => {};
  const server = spawn("npm run dev:web", { cwd: ROOT, shell: true, stdio: "ignore", detached: process.platform !== "win32" });
  for (let i = 0; i < 120 && !(await isUp()); i++) await new Promise((wait) => setTimeout(wait, 500));
  if (!(await isUp())) throw new Error("the app preview (npm run dev:web) did not start");
  return () => {
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-server.pid, "SIGTERM");
  };
}

const sleep = (ms) => new Promise((wait) => setTimeout(wait, ms));

/** Chaque scène prépare l'écran à capturer. L'ordre compte : le lancement nourrit l'historique. */
const SCENES = [
  {
    name: "detail-launch",
    async prepare(page) {
      await page.getByRole("button", { name: "Dev SaaS" }).click();
      await page.getByRole("button", { name: "Launch", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "launched in" }).waitFor();
    },
  },
  {
    name: "presets",
    async prepare(page) {
      await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Presets" }).click();
      await page.getByText("1 running").waitFor();
    },
  },
  {
    name: "editor-variables",
    async prepare(page) {
      await page.getByRole("button", { name: "Next.js project" }).click();
      await page.getByRole("button", { name: "Edit" }).click();
      await page.getByRole("heading", { name: "Variables" }).scrollIntoViewIfNeeded();
    },
  },
  {
    name: "recent",
    async prepare(page) {
      // Quitter l'éditeur (aucune modification : pas de question), puis l'historique.
      await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Recent" }).click();
      await page.locator("main section li button[aria-expanded]").first().click();
    },
  },
];

/** Redimensionne et encode en WebP dans le navigateur. */
async function toWebp(encoder, png, width) {
  const dataUrl = await encoder.evaluate(
    async ({ src, width }) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.round((image.height * width) / image.width);
      const context = canvas.getContext("2d");
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", 0.88);
    },
    { src: `data:image/png;base64,${png.toString("base64")}`, width },
  );
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

const stopPreview = await ensureAppPreview();
const browser = await chromium.launch(process.platform === "win32" ? { channel: "msedge" } : {});
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto(APP_URL);
  await page.getByRole("heading", { level: 1, name: "Presets" }).waitFor();
  const encoder = await context.newPage();

  mkdirSync(OUT, { recursive: true });
  for (const scene of SCENES) {
    await scene.prepare(page);
    await sleep(500); // fin des fondus d'arrivée sur l'écran
    const png = await page.screenshot();
    for (const width of WIDTHS) {
      const file = join(OUT, `${scene.name}-${width}.webp`);
      writeFileSync(file, await toWebp(encoder, png, width));
    }
    console.log(`✓ ${scene.name} → ${OUT}`);
  }
} finally {
  await browser.close();
  stopPreview();
}
