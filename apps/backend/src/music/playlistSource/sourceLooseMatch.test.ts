/**
 * Le monde clos d'une playlist importée, sur des cas relevés le 27/10 (une playlist importée d'Apple Music, titres
 * inventés ici) : la source et Jellyfin (les étiquettes de Lidarr) n'écrivent pas l'artiste — parfois le titre —
 * dans la même écriture.
 */

import { describe, expect, it } from "vitest";
import type { IndexRow } from "../index/indexTypes";
import { bindEntries } from "./sourceBinding";
import { baseTitle, looseSlot } from "./sourceLooseMatch";
import type { SourceSlot } from "./sourceRecord";

const slot = (rank: number, title: string, artist: string, album: string | null, durationMs: number): SourceSlot => ({ rank, title, artists: [artist], album, durationMs, itemIds: [] });
const row = (id: string, name: string, artist: string, albumName: string | null, durationMs: number): IndexRow =>
  ({ id, kind: "track", name, artists: [{ name: artist, mbid: null }], albumName, durationMs, recordingMbid: null, albumArtist: null, discNumber: null, trackNumber: null }) as unknown as IndexRow;

const SOURCE = [
  slot(74, "Starlight Run", "Hiro Sato", "Sky Saga Soundtrack Selection", 389_400),
  slot(77, "夜明けの歌 -OST ver.- (feat. Mika)", "Ken Yamamoto", "星の物語", 330_427),
  slot(78, "決戦開始", "Ken Yamamoto", "星の物語", 190_681),
  slot(115, "TITANFALL", "Kenji Mori", "TVアニメ「空の城」", 331_653),
  slot(134, "Moment", "田中明", "SKY SAGA SEASON 3 - Original Soundtrack ~Selected Version~", 54_333),
  slot(191, "Lena!", "The Blue Lanterns", "Lena!", 186_986),
];

describe("reconnaître un élément parmi les titres de SA source", () => {
  it("le titre de base : sans parenthèses, crochets, accents ni ponctuation, toute écriture", () => {
    expect(baseTitle("Skyline (from the series Sky Saga)")).toBe("skyline");
    expect(baseTitle("NOITE ESCURA (Slowed)")).toBe(baseTitle("NOITE ESCURA (slowed)"));
    expect(baseTitle("Ça Va Mal")).toBe("cavamal");
    expect(baseTitle("WeSee/T:T")).toBe("weseett");
    expect(baseTitle("決戦開始")).toBe("決戦開始");
  });

  it("même titre, artiste écrit autrement (« 田中明 » / « Akira Tanaka ») : reconnu par la durée proche", () => {
    expect(looseSlot(SOURCE, row("m", "Moment", "Akira Tanaka", "SKY SAGA SEASON 3 - Original Soundtrack", 54_333))?.rank).toBe(134);
    expect(looseSlot(SOURCE, row("y", "Starlight Run", "佐藤宏", null, 389_400))?.rank).toBe(74);
  });

  it("titre écrit dans une autre écriture : la durée quasi identique, si UN seul titre libre l'a", () => {
    expect(looseSlot(SOURCE, row("k", "Yoake no Uta -OST version- (feat. Mika)", "山本健", null, 330_427))?.rank).toBe(77);
    expect(looseSlot(SOURCE, row("d", "Kessen Kaishi", "山本健", null, 190_681))?.rank).toBe(78);
    // Deux titres libres à moins d'une seconde : rien de sûr.
    expect(looseSlot([...SOURCE, slot(300, "Autre", "X", null, 190_900)], row("d", "Kessen Kaishi", "山本健", null, 190_681))).toBeNull();
  });

  it("rien à voir : rien", () => {
    expect(looseSlot(SOURCE, row("z", "Chanson sans rapport", "Personne", null, 355_000))).toBeNull();
  });

  it("la réparation : la règle du cœur, puis le monde clos — le titre de base d'abord, la durée ensuite", () => {
    const rows = new Map(
      [
        row("titan", "TITANFALL", "森健二", null, 331_653),
        row("yoake", "Yoake no Uta -OST version- (feat. Mika)", "山本健", null, 330_427),
        row("lena", "Lena", "Silver Service", "Lena", 190_853),
        row("kessen", "Kessen Kaishi", "山本健", null, 190_681),
      ].map((r) => [r.id, r]),
    );
    // « Lena » (la livraison de Lidarr pour « Lena! ») d'abord par son titre : « Kessen Kaishi » garde SA durée.
    const bound = bindEntries(SOURCE, ["kessen", "yoake", "lena", "titan"], rows);
    expect(bound.filter((s) => s.itemIds.length > 0).map((s) => [s.rank, s.itemIds])).toEqual([
      [77, ["yoake"]],
      [78, ["kessen"]],
      [115, ["titan"]],
      [191, ["lena"]],
    ]);
  });
});
