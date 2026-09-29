import { describe, expect, it } from "vitest";
import { formatArguments, parseArguments } from "@/features/presets/editor/arguments";

describe("parseArguments", () => {
  it.each([
    ["", []],
    ["   ", []],
    [".", ["."]],
    ["-d .", ["-d", "."]],
    ["  --new-window    .  ", ["--new-window", "."]],
    ['-d "C:\\My Projects\\app"', ["-d", "C:\\My Projects\\app"]],
    ["C:\\Users\\me", ["C:\\Users\\me"]],
    ['--title ""', ["--title", ""]],
    ['--name="My App"', ["--name=My App"]],
    ['"unterminated quote', ["unterminated quote"]],
  ])("%j → %j", (text, expected) => {
    expect(parseArguments(text)).toEqual(expected);
  });
});

describe("formatArguments", () => {
  it("met entre guillemets les arguments vides ou contenant des espaces", () => {
    expect(formatArguments(["-d", "C:\\My Projects", "", "."])).toBe('-d "C:\\My Projects" "" .');
  });

  it.each([[["-d", "."]], [["--title", "My window", ""]], [["C:\\Program Files\\x", "--flag"]], [[]]])(
    "aller-retour sans perte : %j",
    (args) => {
      expect(parseArguments(formatArguments(args))).toEqual(args);
    },
  );
});
