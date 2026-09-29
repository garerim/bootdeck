import { describe, expect, it } from "vitest";
import {
  absolutePath,
  httpUrl,
  isAbsoluteOrHomePath,
  programPath,
  shellCommand,
} from "@/domain/preset/fields";

describe("isAbsoluteOrHomePath", () => {
  it.each([
    "C:\\Users\\me\\Projects",
    "d:/dev/app",
    "\\\\server\\share\\folder",
    "/home/me/projects",
    "~",
    "~/Projects/my-saas",
    "~\\Projects\\my-saas",
  ])("accepte %s", (path) => {
    expect(isAbsoluteOrHomePath(path)).toBe(true);
  });

  it.each([
    ["Projects/my-saas", "relatif à un dossier inconnu"],
    ["..\\secrets", "remonte depuis un dossier inconnu"],
    ["./app", "relatif au dossier courant"],
    ["C:relative", "relatif au dossier courant du lecteur C:"],
    ["~user/projects", "dossier personnel d'un autre utilisateur, non géré"],
    ["", "vide"],
  ])("refuse %s (%s)", (path) => {
    expect(isAbsoluteOrHomePath(path)).toBe(false);
  });
});

describe("absolutePath", () => {
  it("supprime les espaces autour du chemin", () => {
    expect(absolutePath.parse("  ~/Projects  ")).toBe("~/Projects");
  });

  it("refuse un chemin contenant un caractère de contrôle", () => {
    expect(absolutePath.safeParse("C:\\app\u0000.exe").success).toBe(false);
  });
});

describe("httpUrl", () => {
  it.each(["http://localhost:3000", "https://supabase.com/dashboard", "https://ui.shadcn.com"])(
    "accepte %s",
    (url) => {
      expect(httpUrl.safeParse(url).success).toBe(true);
    },
  );

  it("supprime les espaces autour de l'URL", () => {
    expect(httpUrl.parse("  https://vercel.com  ")).toBe("https://vercel.com");
  });

  it.each([
    ["javascript:alert(1)", "exécuterait du code"],
    ["file:///C:/Windows/System32/calc.exe", "ouvrirait un fichier local"],
    ["ms-msdt:/id PCWDiagnostic", "déclencherait un programme via l'OS"],
    ["ftp://example.com", "protocole non web"],
    ["supabase.com/dashboard", "schéma manquant"],
    ["", "vide"],
  ])("refuse %s (%s)", (url) => {
    const result = httpUrl.safeParse(url);
    expect(result.success).toBe(false);
  });
});

describe("programPath", () => {
  it.each(["code", "wt.exe", "C:\\Program Files\\App\\app.exe", "/usr/bin/code", "~/bin/tool"])(
    "accepte %s",
    (program) => {
      expect(programPath.safeParse(program).success).toBe(true);
    },
  );

  it.each([
    ["bin/code", "chemin relatif"],
    ["..\\app.exe", "chemin relatif"],
    ["code\nshutdown /s", "retour à la ligne"],
  ])("refuse %s (%s)", (program) => {
    expect(programPath.safeParse(program).success).toBe(false);
  });
});

describe("shellCommand", () => {
  it.each(["npm run dev", "git fetch --all --prune && git status"])("accepte %s", (command) => {
    expect(shellCommand.safeParse(command).success).toBe(true);
  });

  it.each([
    ["", "vide"],
    ["   ", "uniquement des espaces"],
    ["npm run dev\nshutdown /s", "seconde commande cachée sur une nouvelle ligne"],
    ["npm run dev\r\ndel /q *", "retour à la ligne Windows"],
  ])("refuse %j (%s)", (command) => {
    expect(shellCommand.safeParse(command).success).toBe(false);
  });
});
