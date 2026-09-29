import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("résout les conflits entre classes Tailwind (la dernière gagne)", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("ignore les valeurs falsy", () => {
    const hidden = false;
    expect(cn("text-sm", hidden && "hidden", undefined)).toBe("text-sm");
  });
});
