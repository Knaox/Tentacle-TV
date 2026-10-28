import { describe, expect, it } from "vitest";
import { albumNotesOf } from "./albumNotes";

describe("albumNotesOf", () => {
  it("rien sans description (serveur d'avant, album sans notes)", () => {
    expect(albumNotesOf(null)).toEqual([]);
    expect(albumNotesOf({})).toEqual([]);
    expect(albumNotesOf({ description: null })).toEqual([]);
    expect(albumNotesOf({ description: "  \n " })).toEqual([]);
  });

  it("une ligne par ligne de la description, lignes vides retirées", () => {
    const lines = albumNotesOf({ description: "Contenu libre de droit.\n\n  Auteur : Kevin MacLeod  " });
    expect(lines).toEqual([[{ kind: "text", text: "Contenu libre de droit." }], [{ kind: "text", text: "Auteur : Kevin MacLeod" }]]);
  });

  it("repère les adresses, sans la ponctuation qui les suit", () => {
    const [line] = albumNotesOf({ description: "Licence : CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/. Merci" });
    expect(line).toEqual([
      { kind: "text", text: "Licence : CC BY 4.0 — " },
      { kind: "link", text: "https://creativecommons.org/licenses/by/4.0/", url: "https://creativecommons.org/licenses/by/4.0/" },
      { kind: "text", text: ". Merci" },
    ]);
  });

  it("n'ouvre que le http(s)", () => {
    const [line] = albumNotesOf({ description: "javascript:alert(1) ftp://x.y" });
    expect(line).toEqual([{ kind: "text", text: "javascript:alert(1) ftp://x.y" }]);
  });
});
