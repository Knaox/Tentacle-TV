import { describe, expect, it } from "vitest";
import { applyCustomOrder, type MusicListPrefs, type MusicListStats } from "@tentacle-tv/shared/music";
import type { ListRow } from "@tentacle-tv/shared/octave";
import { externalTrack, libraryTrack } from "@tentacle-tv/shared/octave/testing";
import {
  customOf,
  foldText,
  jellyfinEntryOrder,
  movedRows,
  prefsAfterMove,
  reorderBlock,
  rowMatches,
  rowSubject,
  searchTokens,
  usefulFilters,
  visibleListRows,
  type StatsOf,
} from "./listView";

function lib(id: string, title: string, extra: Partial<Parameters<typeof libraryTrack>[1]> = {}): ListRow {
  return { rowKey: `e-${id}`, track: libraryTrack(id, { title, ...extra }), pending: null, entryId: `e-${id}` };
}
function waiting(id: string, title: string, recording: string): ListRow {
  const track = externalTrack("sillon", id, { title, availability: "remote", mbids: { recording, release: null, releaseGroup: null, artist: null } as never });
  return { rowKey: `pending:${id}`, track, pending: { operationId: id, failed: false, note: null }, entryId: null };
}
const stats = (map: Record<string, Partial<MusicListStats>>): StatsOf => (row) => {
  const s = map[row.track.key];
  return s ? { addedAt: null, plays: 0, lastPlayedAt: null, ...s } : null;
};
const titles = (rows: readonly ListRow[]) => rows.map((r) => r.track.title);
const prefs = (sort: MusicListPrefs["sort"], direction: MusicListPrefs["direction"] = "asc", custom: MusicListPrefs["custom"] = null): MusicListPrefs => ({ sort, direction, custom });

// Une playlist MIXTE : des titres de la bibliothèque, et des titres importés en attente (Sillon).
const natural = [lib("1", "Alpha"), waiting("w1", "Bravo", "rec-b"), lib("2", "Charlie"), lib("3", "Delta"), waiting("w2", "Écho", "rec-e")];
const added = stats({ "jf:1": { addedAt: 100 }, [natural[1]!.track.key]: { addedAt: 400 }, "jf:2": { addedAt: 200 }, "jf:3": { addedAt: 500, plays: 3 }, [natural[4]!.track.key]: { addedAt: 300 } });

describe("le cas de Damien : trier par dernier ajout, puis glisser", () => {
  it("le tri passe à « Personnalisé », l'ordre de départ est celui qui était affiché", () => {
    const shown = visibleListRows(natural, added, { prefs: prefs("added", "desc"), query: "", filter: "all" });
    expect(titles(shown)).toEqual(["Delta", "Bravo", "Écho", "Charlie", "Alpha"]);
    // Glisser « Alpha » (dernière) en 2e place.
    const moved = movedRows(shown, 4, 1);
    const next = prefsAfterMove(prefs("added", "desc"), moved);
    expect(next.sort).toBe("custom");
    const again = visibleListRows(natural, added, { prefs: next, query: "", filter: "all" });
    expect(titles(again)).toEqual(["Delta", "Alpha", "Bravo", "Écho", "Charlie"]);
  });

  it("la playlist Jellyfin reçoit l'ordre de SES entrées ; les attentes gardent leur place par la préférence", () => {
    const moved = movedRows(visibleListRows(natural, added, { prefs: prefs("added", "desc"), query: "", filter: "all" }), 4, 1);
    expect(jellyfinEntryOrder(moved)).toEqual(["e-3", "e-1", "e-2"]);
    const custom = customOf(moved);
    expect(custom.find((c) => c.k === natural[1]!.track.key)).toEqual({ k: natural[1]!.track.key, r: "rec-b" });
  });

  it("l'attente devenue « bibliothèque » reste à la place glissée", () => {
    const custom = customOf([natural[3]!, natural[1]!, natural[0]!, natural[2]!]);
    const arrived: ListRow = { ...lib("9", "Bravo", { mbids: { recording: "rec-b", release: null, releaseGroup: null, artist: null } as never }) };
    const after = [natural[0]!, natural[2]!, natural[3]!, arrived];
    expect(titles(applyCustomOrder(after, (r) => rowSubject(r, null), custom))).toEqual(["Delta", "Bravo", "Alpha", "Charlie"]);
  });
});

describe("recherche et filtres", () => {
  it("sans accents ni casse, chaque mot dans le titre, un artiste ou l'album", () => {
    expect(foldText("  Beyoncé — Halo! ")).toBe("beyonce halo");
    expect(searchTokens("ÉCHO")).toEqual(["echo"]);
    expect(rowMatches(natural[4]!, searchTokens("echo"))).toBe(true);
    expect(rowMatches(natural[0]!, searchTokens("artiste alp"))).toBe(true);
    expect(rowMatches(natural[0]!, searchTokens("bravo"))).toBe(false);
    expect(titles(visibleListRows(natural, added, { prefs: prefs("title"), query: "elt", filter: "all" }))).toEqual(["Delta"]);
  });

  it("filtres : seulement ceux qui ont un sens, et ce qu'ils gardent", () => {
    expect(usefulFilters(natural, added)).toEqual(["all", "library", "elsewhere", "unplayed"]);
    expect(usefulFilters([natural[0]!, natural[2]!], () => null)).toEqual(["all"]);
    expect(titles(visibleListRows(natural, added, { prefs: prefs("title"), query: "", filter: "elsewhere" }))).toEqual(["Bravo", "Écho"]);
    expect(titles(visibleListRows(natural, added, { prefs: prefs("title"), query: "", filter: "library" }))).toEqual(["Alpha", "Charlie", "Delta"]);
    expect(titles(visibleListRows(natural, added, { prefs: prefs("title"), query: "", filter: "unplayed" }))).not.toContain("Delta");
  });

  it("pas de glisser pendant une recherche ou un filtre", () => {
    expect(reorderBlock({ prefs: prefs("custom"), query: "  ", filter: "all" })).toBeNull();
    expect(reorderBlock({ prefs: prefs("custom"), query: "a", filter: "all" })).toBe("search");
    expect(reorderBlock({ prefs: prefs("title"), query: "", filter: "library" })).toBe("filter");
  });

  it("déplacer : bornes et identité", () => {
    expect(movedRows([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(movedRows([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(movedRows([1, 2, 3], 1, 1)).toEqual([1, 2, 3]);
    expect(movedRows([1, 2, 3], 0, 99)).toEqual([2, 3, 1]);
  });
});

describe("1 000 titres", () => {
  const big = Array.from({ length: 1000 }, (_, i) => lib(String(i), `Titre ${(i * 7919) % 1000}`, { artists: [{ name: `Artiste ${i % 41}`, mbid: null, jellyfinId: null }] }));
  const bigStats: StatsOf = (r) => ({ addedAt: Number(r.track.jellyfinId), plays: Number(r.track.jellyfinId) % 9, lastPlayedAt: null });

  it("trier, chercher, glisser puis réappliquer l'ordre : sous le budget d'une image par geste", () => {
    const t0 = performance.now();
    const shown = visibleListRows(big, bigStats, { prefs: prefs("added", "desc"), query: "", filter: "all" });
    const t1 = performance.now();
    visibleListRows(big, bigStats, { prefs: prefs("artist"), query: "titre 9", filter: "all" });
    const t2 = performance.now();
    const next = prefsAfterMove(prefs("added", "desc"), movedRows(shown, 999, 0));
    const reordered = visibleListRows(big, bigStats, { prefs: next, query: "", filter: "all" });
    const t3 = performance.now();
    expect(reordered[0]!.track.jellyfinId).toBe("0");
    expect(reordered[1]!.track.jellyfinId).toBe("999");
    // Mesures (affichées au rapport) : tri, recherche, glisser + réapplication.
    process.stdout.write(`[mesure 1000] tri ${(t1 - t0).toFixed(1)} ms · recherche ${(t2 - t1).toFixed(1)} ms · glisser ${(t3 - t2).toFixed(1)} ms\n`);
    expect(t3 - t0).toBeLessThan(250);
  });
});
