import { describe, expect, it } from "vitest";
import {
  hasVariables,
  parseTemplate,
  renderTemplate,
  templateVariables,
} from "@/domain/variables/template";

describe("parseTemplate", () => {
  it("sépare le texte et les variables", () => {
    expect(parseTemplate("~/Projects/{project}/app")).toEqual([
      { type: "text", value: "~/Projects/" },
      { type: "variable", name: "project" },
      { type: "text", value: "/app" },
    ]);
  });

  it("reconnaît des variables collées et répétées", () => {
    expect(templateVariables("{host}:{port}/{port}")).toEqual(["host", "port"]);
  });

  it.each([
    ['{"name": "demo"}', "JSON"],
    ["echo ${HOME}", "variable de shell en majuscules"],
    ["$env:PATH", "variable PowerShell"],
    ["{Project}", "majuscule"],
    ["{2fast}", "commence par un chiffre"],
    ["{ project }", "espaces"],
    ["{}", "vide"],
  ])("laisse %j tel quel (%s)", (text) => {
    expect(hasVariables(text)).toBe(false);
    expect(renderTemplate(text, {})).toEqual({ ok: true, value: text });
  });

  it("interprète {{ et }} comme des accolades littérales", () => {
    expect(parseTemplate("{{project}}")).toEqual([{ type: "text", value: "{project}" }]);
    expect(renderTemplate("echo {{ {name} }}", { name: "x" })).toEqual({ ok: true, value: "echo { x }" });
  });
});

describe("renderTemplate", () => {
  it("remplace chaque variable par sa valeur", () => {
    expect(renderTemplate("http://localhost:{port}/{port}", { port: "3000" })).toEqual({
      ok: true,
      value: "http://localhost:3000/3000",
    });
  });

  it("n'accepte jamais une variable sans valeur, et les liste toutes", () => {
    expect(renderTemplate("{a}-{b}-{a}", {})).toEqual({ ok: false, missing: ["a", "b"] });
  });

  it("ne confond pas une variable avec une propriété héritée des objets JavaScript", () => {
    expect(renderTemplate("{constructor}", {})).toEqual({ ok: false, missing: ["constructor"] });
  });
});
