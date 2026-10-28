import { describe, expect, it } from "vitest";
import { describeTrack } from "./trackDescription";

const WORDS = { default: "Par défaut", forced: "Forcé", external: "Externe" };

describe("describeTrack", () => {
  it("la langue en titre, le format et les drapeaux en mots", () => {
    expect(describeTrack("English - SUBRIP - External", WORDS)).toEqual({ title: "English", detail: "SRT · Externe" });
    expect(describeTrack("Français - EAC3 - 5.1 - Default", WORDS)).toEqual({ title: "Français", detail: "Dolby Digital+ · 5.1 · Par défaut" });
  });

  it("le codec ajouté entre parenthèses, sans doublon", () => {
    expect(describeTrack("Français - Dolby Digital - Default (AC3)", WORDS)).toEqual({ title: "Français", detail: "Dolby Digital · Par défaut" });
  });

  it("un libellé sans détail reste tel quel", () => {
    expect(describeTrack("Commentaires", WORDS)).toEqual({ title: "Commentaires", detail: undefined });
  });
});
