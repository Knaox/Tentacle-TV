import { describe, expect, it } from "vitest";
import type { MusicPlaylist } from "../../music";
import { chooserSections } from "./chooserSections";

const pl = (id: string, editable = true) => ({ jellyfinId: id, name: id, trackCount: 0, durationMs: null, artworkUrl: null, editable }) as MusicPlaylist;
const ids = (list: readonly MusicPlaylist[]) => list.map((p) => p.jellyfinId);

describe("« Ajouter à une playlist » : les favorites d'abord (lot fl)", () => {
  it("favorites dans l'ordre personnel, puis le reste dans le sien ; seulement les modifiables", () => {
    const editable = [pl("a"), pl("b"), pl("c"), pl("d")];
    const out = chooserSections(editable, [pl("c"), pl("x"), pl("a")], [pl("d"), pl("b")]);
    expect(ids(out.favorites)).toEqual(["c", "a"]);
    expect(ids(out.others)).toEqual(["d", "b"]);
  });

  it("aucune favorite (ou serveur d'avant) : une seule liste, rien de perdu", () => {
    const out = chooserSections([pl("a"), pl("b")], [], []);
    expect(out.favorites).toEqual([]);
    expect(ids(out.others)).toEqual(["a", "b"]);
  });
});
