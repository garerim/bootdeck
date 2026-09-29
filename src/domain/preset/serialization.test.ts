import { describe, expect, it } from "vitest";
import { demoPresets } from "@/domain/preset/fixtures";
import { CURRENT_SCHEMA_VERSION, type Preset } from "@/domain/preset/schema";
import { parsePresetsFile, serializePresetsFile } from "@/domain/preset/serialization";
import { renderTemplate } from "@/domain/variables/template";

function demoPreset(index = 0): Preset {
  const preset = demoPresets[index];
  if (!preset) throw new Error(`Aucun preset de démonstration à l'index ${index}`);
  return structuredClone(preset);
}

describe("serializePresetsFile", () => {
  it("produit un JSON indenté et versionné", () => {
    const content = serializePresetsFile([]);
    expect(content).toBe(`{\n  "schemaVersion": ${CURRENT_SCHEMA_VERSION},\n  "presets": []\n}\n`);
  });

  it("refuse d'écrire des données invalides", () => {
    const invalid = { ...demoPreset(), name: "" };
    expect(() => serializePresetsFile([invalid])).toThrow();
  });
});

describe("parsePresetsFile", () => {
  it("relit exactement ce qui a été écrit (aller-retour)", () => {
    const result = parsePresetsFile(serializePresetsFile(demoPresets));
    expect(result).toEqual({ ok: true, file: { schemaVersion: CURRENT_SCHEMA_VERSION, presets: demoPresets } });
  });

  it("signale un JSON illisible sans lever d'exception", () => {
    const result = parsePresetsFile('{ "schemaVersion": 1, "presets": [');
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid-json" } });
  });

  it("signale un fichier écrit par une version plus récente, sans le juger corrompu", () => {
    const fromTheFuture = JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION + 1, presets: [{ shape: "inconnue" }] });
    const result = parsePresetsFile(fromTheFuture);
    expect(result).toEqual({
      ok: false,
      error: { kind: "unsupported-version", found: CURRENT_SCHEMA_VERSION + 1, expected: CURRENT_SCHEMA_VERSION },
    });
  });

  it("signale un fichier sans numéro de version", () => {
    const result = parsePresetsFile(JSON.stringify({ presets: [] }));
    expect(result).toMatchObject({
      ok: false,
      error: { kind: "invalid-data", issues: [{ path: "schemaVersion" }] },
    });
  });

  it("indique l'emplacement exact d'une valeur invalide", () => {
    const preset = demoPreset();
    preset.items = preset.items.map((item, index) =>
      index === 3 && item.type === "url" ? { ...item, config: { url: "javascript:alert(1)" } } : item,
    );
    const result = parsePresetsFile(JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, presets: [preset] }));
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "invalid-data",
        issues: [{ path: "presets[0].items[3].config.url", message: "Must be an http:// or https:// URL" }],
      },
    });
  });

  it("signale une variable utilisée mais non déclarée, à l'emplacement du champ", () => {
    const preset = demoPreset(3); // « Next.js project »
    preset.variables = preset.variables.filter((variable) => variable.key !== "port");
    const result = parsePresetsFile(JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, presets: [preset] }));
    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "invalid-data",
        issues: [
          { path: "presets[0].items[1].config.command", message: expect.stringContaining("Unknown variable {port}") },
          { path: "presets[0].items[2].config.url", message: expect.stringContaining("Unknown variable {port}") },
        ],
      },
    });
  });

  it("refuse deux presets avec le même id", () => {
    const preset = demoPreset();
    const result = parsePresetsFile(JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, presets: [preset, preset] }));
    expect(result).toMatchObject({
      ok: false,
      error: { kind: "invalid-data", issues: [{ path: "presets[1].id", message: "Duplicate preset id" }] },
    });
  });
});

describe("migration v1 → v2", () => {
  const v1File = {
    schemaVersion: 1,
    presets: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Legacy",
        items: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            type: "command",
            name: "Braces",
            enabled: true,
            config: { command: "echo {a} and {{b}}", workingDirectory: "~/Projects/app" },
          },
          {
            id: "33333333-3333-4333-8333-333333333333",
            type: "application",
            name: "App",
            enabled: true,
            config: { path: "code", args: ["--title", "{x}"] },
          },
        ],
        createdAt: "2026-09-01T08:00:00.000Z",
        updatedAt: "2026-09-01T08:00:00.000Z",
      },
    ],
  };

  it("met un fichier v1 à la version actuelle en ajoutant une liste de variables vide", () => {
    const result = parsePresetsFile(JSON.stringify(v1File));
    expect(result).toMatchObject({ ok: true, migratedFrom: 1, file: { schemaVersion: CURRENT_SCHEMA_VERSION } });
    expect(result.ok && result.file.presets[0]?.variables).toEqual([]);
  });

  it("préserve le sens des accolades : littérales en v1, elles le restent", () => {
    const result = parsePresetsFile(JSON.stringify(v1File));
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const [command, app] = result.file.presets[0]?.items ?? [];
    expect(command?.type === "command" && command.config.command).toBe("echo {{a}} and {{{{b}}}}");
    expect(app?.type === "application" && app.config.args).toEqual(["--title", "{{x}}"]);
    // Une fois rendu, le texte est EXACTEMENT celui de la v1.
    expect(renderTemplate("echo {{a}} and {{{{b}}}}", {})).toEqual({ ok: true, value: "echo {a} and {{b}}" });
  });

  it("n'indique aucune migration pour un fichier déjà à jour", () => {
    const result = parsePresetsFile(serializePresetsFile(demoPresets));
    expect(result.ok && "migratedFrom" in result).toBe(false);
  });
});
