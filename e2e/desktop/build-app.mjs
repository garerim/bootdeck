// Compile la variante E2E de l'application desktop (identifiant `dev.workspacepresets.e2e`),
// dans son propre dossier de compilation : l'exécutable de `npm run dev` n'est pas touché.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const result = spawnSync("npm run tauri -- build --debug --no-bundle --config src-tauri/tauri.e2e.conf.json", {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, CARGO_TARGET_DIR: resolve("src-tauri/target/e2e") },
});
process.exit(result.status ?? 1);
