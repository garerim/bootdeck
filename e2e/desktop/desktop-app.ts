import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";

/**
 * L'application desktop réelle, pilotée par Playwright à travers sa WebView2
 * (Chromium) grâce au protocole CDP. Windows uniquement.
 *
 * C'est une variante compilée avec l'identifiant `dev.bootdeck.e2e`
 * (`src-tauri/tauri.e2e.conf.json`) : ses données, son instance unique et son profil
 * WebView2 sont séparés de ceux de l'app de l'utilisateur, qui peut rester ouverte.
 */
export const E2E_IDENTIFIER = "dev.bootdeck.e2e";
export const APP_EXE = resolve("src-tauri/target/e2e/debug/bootdeck.exe");
const APP_ORIGIN = "http://tauri.localhost";

export interface DesktopApp {
  page: Page;
  close: () => Promise<void>;
}

export interface LaunchOptions {
  /** Faux : garde les données du lancement précédent (vérifier ce qui a été enregistré). */
  resetData?: boolean;
}

export async function launchDesktopApp({ resetData = true }: LaunchOptions = {}): Promise<DesktopApp> {
  if (!existsSync(APP_EXE)) {
    throw new Error(`${APP_EXE} is missing: run \`npm run test:e2e:desktop\`, which builds it first.`);
  }
  // Données de l'app de test : chaque test repart de zéro.
  if (resetData) removeDesktopAppData();

  const port = await freePort();
  const child = spawn(APP_EXE, [], {
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` },
    stdio: "ignore",
  });
  try {
    const browser = await connect(port);
    const page = await appPage(browser);
    return {
      page,
      close: async () => {
        await browser.close(); // se déconnecte de la WebView sans la fermer
        await closeGracefully(child);
      },
    };
  } catch (error) {
    child.kill();
    throw error;
  }
}

/** Dossier de données de l'app de test (%APPDATA%\dev.bootdeck.e2e), jamais celui de l'utilisateur. */
export function removeDesktopAppData(): void {
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("APPDATA is not set");
  rmSync(join(appData, E2E_IDENTIFIER), { recursive: true, force: true });
}

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => (typeof address === "object" && address ? resolvePort(address.port) : reject(new Error("no port"))));
    });
  });
}

/** La WebView ouvre son port de débogage quelques centaines de millisecondes après le lancement. */
async function connect(port: number): Promise<Browser> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((wait) => setTimeout(wait, 250));
    }
  }
}

/** La première page est `about:blank` : on attend celle de l'app. */
async function appPage(browser: Browser): Promise<Page> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const page = browser
      .contexts()
      .flatMap((context) => context.pages())
      .find((candidate) => candidate.url().startsWith(APP_ORIGIN));
    if (page) {
      await page.waitForLoadState("domcontentloaded");
      return page;
    }
    await new Promise((wait) => setTimeout(wait, 250));
  }
  throw new Error("the app page did not load");
}

/** Fermeture normale (WM_CLOSE) : l'app arrête ses commandes comme à la fermeture par l'utilisateur. */
async function closeGracefully(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.pid === undefined) return;
  const exited = new Promise<void>((done) => child.once("exit", () => done()));
  try {
    execFileSync("taskkill", ["/PID", String(child.pid)], { stdio: "ignore" });
  } catch {
    // Déjà terminée entre-temps.
  }
  const timeout = new Promise<"timeout">((done) => setTimeout(() => done("timeout"), 10_000));
  if ((await Promise.race([exited, timeout])) === "timeout") child.kill();

  // La WebView2 s'arrête un peu après l'app. La relancer pendant ce temps sur le même
  // profil, avec un autre port de débogage, échouerait (erreur 0x8007139F).
  const deadline = Date.now() + 15_000;
  while (webViewProcessesAlive() > 0 && Date.now() < deadline) {
    await new Promise((wait) => setTimeout(wait, 250));
  }
}

function webViewProcessesAlive(): number {
  const script = `@(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -like '*${E2E_IDENTIFIER}*' }).Count`;
  return Number(execFileSync("powershell", ["-NoProfile", "-Command", script]).toString().trim());
}

/** Fenêtres de l'Explorateur ouvertes sur un dossier (API Shell.Application de Windows). */
export function explorerWindowsShowing(folderName: string): number {
  const script = `@((New-Object -ComObject Shell.Application).Windows() | Where-Object { $_.LocationURL -like '*${folderName}*' }).Count`;
  return Number(execFileSync("powershell", ["-NoProfile", "-Command", script]).toString().trim());
}

export function closeExplorerWindows(folderName: string): void {
  const script = `(New-Object -ComObject Shell.Application).Windows() | Where-Object { $_.LocationURL -like '*${folderName}*' } | ForEach-Object { $_.Quit() }`;
  execFileSync("powershell", ["-NoProfile", "-Command", script], { stdio: "ignore" });
}
