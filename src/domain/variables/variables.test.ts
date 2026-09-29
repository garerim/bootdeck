import { describe, expect, it } from "vitest";
import { demoPresets } from "@/domain/preset/fixtures";
import type { PresetItem } from "@/domain/preset/schema";
import {
  VARIABLE_KINDS,
  createVariableResolver,
  defaultValueProblem,
  prefillInputs,
  resolveValues,
  variableLabel,
  variablesUsedBy,
  type VariableDefinition,
} from "@/domain/variables/variables";

const nextjs = demoPresets[3];
if (!nextjs) throw new Error("preset de démonstration « Next.js project » manquant");

describe("types de variables", () => {
  it.each([
    ["text", "my-saas", true],
    ["text", "v1.2_final", true],
    ["text", "my saas", false],
    ["text", "x & del *", false],
    ["text", "$(whoami)", false],
    ["path", "~/Projects/my-saas", true],
    ["path", "C:\\My Projects\\app", true],
    ["path", "Projects/app", false],
    ["path", "C:\\app & calc", false],
    ["path", 'C:\\a"b', false],
    ["port", "3000", true],
    ["port", "65535", true],
    ["port", "0", false],
    ["port", "70000", false],
    ["port", "3000; rm -rf /", false],
  ] as const)("%s : %j → %s", (kind, value, accepted) => {
    expect(VARIABLE_KINDS[kind].validate(value) === null).toBe(accepted);
  });
});

describe("resolveValues", () => {
  it("utilise les valeurs par défaut, et une variable peut utiliser celles déclarées avant elle", () => {
    expect(resolveValues(nextjs.variables, {})).toEqual({
      ok: true,
      values: { project: "my-saas", project_path: "~/Projects/my-saas", port: "3000" },
    });
  });

  it("les valeurs saisies remplacent les valeurs par défaut", () => {
    const result = resolveValues(nextjs.variables, { project: "blog", port: "5173" });
    expect(result).toEqual({
      ok: true,
      values: { project: "blog", project_path: "~/Projects/blog", port: "5173" },
    });
  });

  it("rapporte une erreur par variable invalide, avec un message clair", () => {
    const result = resolveValues(nextjs.variables, { project: "my saas", port: "99999" });
    expect(result).toEqual({
      ok: false,
      errors: {
        project: "Use only letters, digits, dots, dashes and underscores.",
        project_path: "Uses {project}, which must be declared above and valid.",
        port: "Use a number between 1 and 65535.",
      },
    });
  });

  it("exige une valeur quand il n'y a pas de défaut", () => {
    const definitions: VariableDefinition[] = [{ key: "branch", kind: "text" }];
    expect(resolveValues(definitions, { branch: "  " })).toEqual({
      ok: false,
      errors: { branch: "A value is required." },
    });
  });
});

describe("defaultValueProblem", () => {
  const port: VariableDefinition = { key: "port", kind: "port", defaultValue: "3000" };

  it("accepte une valeur par défaut valide ou qui utilise une variable déclarée avant", () => {
    expect(defaultValueProblem(port, new Set())).toBeNull();
    expect(defaultValueProblem({ key: "url", kind: "text", defaultValue: "{port}" }, new Set(["port"]))).toBeNull();
  });

  it("refuse une référence à une variable déclarée après, et une valeur invalide pour son type", () => {
    expect(defaultValueProblem({ key: "a", kind: "text", defaultValue: "{b}" }, new Set())).toBe(
      "{b} must be declared above this variable",
    );
    expect(defaultValueProblem({ ...port, defaultValue: "http" }, new Set())).toBe("Use a number between 1 and 65535.");
  });
});

describe("variablesUsedBy", () => {
  it("liste les variables utilisées par les items, sans doublon", () => {
    expect(variablesUsedBy(nextjs.items)).toEqual(["project_path", "port"]);
    expect(variablesUsedBy(demoPresets[0]?.items ?? [])).toEqual([]);
  });
});

describe("createVariableResolver", () => {
  const values = { project_path: "C:/Projects/blog", port: "5173" };

  it("remplace les variables dans tous les champs de l'item", () => {
    const resolve = createVariableResolver(values);
    expect(nextjs.items.map((item) => resolve(item))).toEqual([
      { ok: true, item: { ...nextjs.items[0], config: { path: "code", args: ["."], workingDirectory: "C:/Projects/blog" } } },
      {
        ok: true,
        item: {
          ...nextjs.items[1],
          config: { command: "npm run dev -- --port 5173", workingDirectory: "C:/Projects/blog" },
        },
      },
      { ok: true, item: { ...nextjs.items[2], config: { url: "http://localhost:5173" } } },
    ]);
  });

  it("rend aussi les arguments et les échappements", () => {
    const item: PresetItem = {
      id: "11111111-1111-4111-8111-111111111111",
      type: "application",
      name: "App",
      enabled: true,
      config: { path: "code", args: ["--port", "{port}", '{{"json": true}}'] },
    };
    const result = createVariableResolver(values)(item);
    expect(result.ok && result.item.type === "application" && result.item.config.args).toEqual([
      "--port",
      "5173",
      '{"json": true}',
    ]);
  });

  it("refuse un item dont une variable n'a pas de valeur", () => {
    expect(createVariableResolver({})(nextjs.items[2] as PresetItem)).toEqual({
      ok: false,
      error: "Not launched: no value for {port}.",
    });
  });
});

describe("variableLabel", () => {
  it("utilise le libellé, ou le dérive du nom", () => {
    expect(variableLabel({ key: "project", label: "Project", kind: "text" })).toBe("Project");
    expect(variableLabel({ key: "project_path", kind: "path" })).toBe("Project path");
  });
});

describe("prefillInputs", () => {
  const previous = { project: "blog", project_path: "~/Projects/blog", port: "5173" };

  it("reprend les valeurs du dernier lancement, sauf celles qui dépendent d'autres variables", () => {
    expect(prefillInputs(nextjs.variables, undefined, previous)).toEqual({
      project: "blog",
      project_path: "~/Projects/{project}", // reste un modèle : suivra {project} si on le change
      port: "5173",
    });
  });

  it("donne la priorité à ce qui a été saisi depuis l'ouverture de l'app", () => {
    const typed = { project: "shop", project_path: "D:/work/shop", port: "8080" };
    expect(prefillInputs(nextjs.variables, typed, previous)).toEqual(typed);
  });

  it("utilise les valeurs par défaut sans historique", () => {
    expect(prefillInputs(nextjs.variables, undefined, undefined)).toEqual({
      project: "my-saas",
      project_path: "~/Projects/{project}",
      port: "3000",
    });
  });
});
