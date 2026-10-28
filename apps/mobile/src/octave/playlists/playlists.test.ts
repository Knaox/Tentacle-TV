import { afterEach, describe, expect, it } from "vitest";
import { dragTarget, movedRows, rowShift } from "@tentacle-tv/shared/octave";
import { closePlaylistSheet, openPlaylistSheet, readPlaylistSheet } from "./sheets/playlistSheetStore";

const ROW = 60; // `TRACK_ROW_HEIGHT` des pages du mobile.
const playlist = { jellyfinId: "p".repeat(32), name: "Soirée", trackCount: 3, durationMs: null, artworkUrl: null, editable: true };

describe("playlists d'Octave (mobile) — règles pures", () => {
  afterEach(() => closePlaylistSheet());

  it("une feuille à la fois : la nouvelle remplace l'ancienne, l'import garde le lien reçu", () => {
    openPlaylistSheet({ kind: "manage", playlist });
    openPlaylistSheet({ kind: "import", prefill: "https://ami.fr/octave/share/AbCdEfGhIjKlMnOpQrStUv" });
    expect(readPlaylistSheet()).toEqual({ kind: "import", prefill: "https://ami.fr/octave/share/AbCdEfGhIjKlMnOpQrStUv" });
    closePlaylistSheet();
    expect(readPlaylistSheet()).toBeNull();
  });

  it("le glisser à la hauteur des rangées du mobile : la place visée, les voisines qui s'écartent, l'ordre lâché", () => {
    // Tenue au rang 1, glissée de deux rangées et demie vers le bas : elle vise le rang 4 (arrondi), bornée à la liste.
    expect(dragTarget(1, ROW * 2.6, 5, ROW)).toBe(4);
    expect(dragTarget(1, ROW * 9, 5, ROW)).toBe(4);
    expect(dragTarget(1, -ROW * 3, 5, ROW)).toBe(0);
    // Les rangées entre le départ et l'arrivée remontent d'une rangée ; les autres ne bougent pas.
    expect([0, 1, 2, 3, 4].map((i) => rowShift(i, 1, 3, ROW))).toEqual([0, 0, -ROW, -ROW, 0]);
    expect(movedRows(["a", "b", "c", "d", "e"], 1, 3)).toEqual(["a", "c", "d", "b", "e"]);
  });
});
