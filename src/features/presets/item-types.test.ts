import { describe, expect, it } from "vitest";
import { demoPresets } from "@/domain/preset/fixtures";
import { countItemsByType } from "@/domain/preset/operations";
import { formatItemSummary, itemTarget, itemWorkingDirectory } from "@/features/presets/item-types";

const devSaas = demoPresets[0];

describe("formatItemSummary", () => {
  it("résume les items par type, au pluriel ou au singulier", () => {
    expect(formatItemSummary({ application: 2, url: 4, folder: 0, command: 1 })).toBe("2 apps · 4 URLs · 1 command");
  });

  it("indique l'absence d'items", () => {
    expect(formatItemSummary({ application: 0, url: 0, folder: 0, command: 0 })).toBe("No items");
  });

  it("résume le preset Dev SaaS", () => {
    expect(formatItemSummary(countItemsByType(devSaas?.items ?? []))).toBe("2 apps · 4 URLs · 1 command");
  });
});

describe("itemTarget", () => {
  it("affiche le programme suivi de ses arguments, ou la cible de l'item", () => {
    expect(devSaas?.items.map(itemTarget)).toEqual([
      "code .",
      "wt -d .",
      "npm run dev",
      "http://localhost:3000",
      "https://supabase.com/dashboard",
      "https://vercel.com/dashboard",
      "https://ui.shadcn.com",
    ]);
  });

  it("n'expose un dossier de travail que pour les applications et les commandes", () => {
    expect(devSaas?.items.map(itemWorkingDirectory)).toEqual([
      "~/Projects/my-saas",
      "~/Projects/my-saas",
      "~/Projects/my-saas",
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});
