import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { chatEntrance } from "./chatMotion";

const source = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

describe("chatEntrance — d'où le chat entre", () => {
  it("le panneau et la bulle naissent à 96 %, la feuille monte, l'aperçu vient du bord, la bulle s'enfonce sous le doigt", () => {
    expect(chatEntrance(false)).toEqual({ scale: 0.96, sheetY: 32, toastX: 24, tapScale: 0.97 });
  });

  it("mouvement réduit : ni échelle, ni glissement, ni pression — le fondu seul", () => {
    expect(chatEntrance(true)).toEqual({ scale: 1, sheetY: 0, toastX: 0, tapScale: 1 });
  });

  it("le panneau et les aperçus ne portent plus d'échelle ni de décalage en dur : tout passe par la règle", () => {
    const overlay = source("./ChatOverlay.tsx");
    expect(overlay).not.toMatch(/scale: 0\.9\d/);
    expect(overlay).not.toMatch(/\by: 32\b/);
    expect(overlay).toContain("chatEntrance(");
    const toasts = source("./MessageToastLayer.tsx");
    expect(toasts).not.toMatch(/\bx: 24\b/);
    expect(toasts).toContain("chatEntrance(");
  });
});
