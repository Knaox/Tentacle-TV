import { afterEach, describe, expect, it } from "vitest";
import { forgetOsdButton, osdEntryButton, rememberOsdButton } from "./focusOsd";

/** Les boutons que la rangée rend toujours. */
const ROW = ["recul", "lecture", "avance", "deplacement"];

describe("entrée de l'habillage", () => {
  afterEach(() => forgetOsdButton());

  it("entre par Lecture quand rien n'a été visé", () => {
    expect(osdEntryButton(ROW)).toBe("lecture");
  });

  it("rend le dernier bouton visé de la rangée", () => {
    rememberOsdButton("pistes");
    expect(osdEntryButton([...ROW, "pistes"])).toBe("pistes");
  });

  it("retombe sur Lecture quand le dernier bouton n'est plus rendu", () => {
    // « Épisode suivant » n'existe pas sur le dernier de la saison.
    rememberOsdButton("suivant");
    expect(osdEntryButton(ROW)).toBe("lecture");
  });

  it("ne fait jamais de la sortie une entrée", () => {
    // La tête ne retient plus son bouton ; et le serait-il, la rangée ne le
    // rend pas — l'entrée ne peut désigner qu'un bouton qu'elle rend.
    rememberOsdButton("quitter");
    expect(osdEntryButton(ROW)).toBe("lecture");
  });

  it("repart de Lecture une fois le lecteur démonté", () => {
    rememberOsdButton("avance");
    forgetOsdButton();
    expect(osdEntryButton(ROW)).toBe("lecture");
  });

  it("garde le dernier bouton quand le focus passe par un élément sans clé", () => {
    rememberOsdButton("recul");
    rememberOsdButton(null);
    expect(osdEntryButton(ROW)).toBe("recul");
  });
});
