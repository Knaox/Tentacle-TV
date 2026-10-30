import { describe, expect, it } from "vitest";
import type { MusicListStats, PendingMusicItem } from "@tentacle-tv/shared/music";
import type { ListRow } from "@tentacle-tv/shared/octave";
import { externalTrack, libraryTrack } from "@tentacle-tv/shared/octave/testing";
import { makeStatsOf, placedPendingDates } from "./listStats";
import { visibleListRows } from "./listView";

function lib(id: string): ListRow {
  return { rowKey: `e-${id}`, track: libraryTrack(id, { title: id }), pending: null, entryId: `e-${id}` };
}
function waiting(id: string): ListRow {
  return { rowKey: `pending:${id}`, track: externalTrack("sillon", id, { title: id }), pending: { operationId: id, failed: false, note: null }, entryId: null };
}
const at = (addedAt: number): MusicListStats => ({ addedAt, plays: 0, lastPlayedAt: null });
const asked = (operationId: string, createdAt: number) => ({ operationId, createdAt }) as PendingMusicItem;
const importedAsk = (operationId: string, createdAt: number) => ({ operationId, createdAt, imported: true }) as PendingMusicItem;
const titles = (rows: readonly ListRow[]) => rows.map((r) => r.track.title);
const newestFirst = { prefs: { sort: "added" as const, direction: "desc" as const, custom: null }, query: "", filter: "all" as const };

// La playlist importée de Damien (27/10) : l'import a posé a, b, c et trois attentes ; la première lecture a daté
// les entrées APRÈS les demandes. x attend entre a et b, y entre b et c ; z a été ajouté plus tard, en fin.
const natural = [lib("a"), waiting("x"), lib("b"), waiting("y"), lib("c"), waiting("z")];
const byEntry = new Map([["e-a", at(1_000)], ["e-b", at(1_001)], ["e-c", at(1_002)]]);
const pending = [importedAsk("x", 900), importedAsk("y", 900), asked("z", 5_000)];

describe("« Derniers ajouts » d'une playlist suit l'ordre d'ajout à la playlist", () => {
  it("une attente au milieu prend la date de sa place ; en fin, sa demande", () => {
    const dates = placedPendingDates(natural, byEntry, new Map(pending.map((p) => [p.operationId, p.createdAt])));
    expect(Object.fromEntries(dates)).toEqual({ x: 1_000, y: 1_001, z: 5_000 });
  });

  it("le plus récent en tête : l'ordre de la playlist inversé (avant : les attentes en bloc, à part)", () => {
    const statsOf = makeStatsOf({ byEntry, pending, natural });
    expect(titles(visibleListRows(natural, statsOf, newestFirst))).toEqual(["z", "c", "y", "b", "x", "a"]);
  });

  it("une attente livrée par Lidarr à sa place ne remonte pas en tête (le serveur lui donne la date de sa place)", () => {
    const arrived = [lib("a"), lib("x"), lib("b"), waiting("y"), lib("c"), waiting("z")];
    const statsOf = makeStatsOf({ byEntry: new Map([...byEntry, ["e-x", at(1_000)]]), pending, natural: arrived });
    expect(titles(visibleListRows(arrived, statsOf, newestFirst))).toEqual(["z", "c", "y", "b", "x", "a"]);
  });

  it("une attente demandée APRÈS sa voisine de fin ne passe jamais avant elle", () => {
    const tail = [lib("a"), waiting("z")];
    const dates = placedPendingDates(tail, byEntry, new Map([["z", 10]]));
    expect(dates.get("z")).toBe(1_000);
    expect(titles(visibleListRows(tail, makeStatsOf({ byEntry, pending: [asked("z", 10)], natural: tail }), newestFirst))).toEqual(["z", "a"]);
  });

  it("hors playlist (les likés) : une attente garde l'heure de sa demande", () => {
    const statsOf = makeStatsOf({ pending });
    expect(statsOf(waiting("x"))?.addedAt).toBe(900);
  });

  it("un AJOUT en attente posé en tête (music.addOnTop) garde l'heure de sa demande, jamais celle du titre qui suit", () => {
    const top = [waiting("n"), lib("a"), lib("b")];
    const statsOf = makeStatsOf({ byEntry, pending: [asked("n", 7_000)], natural: top });
    expect(statsOf(waiting("n"))?.addedAt).toBe(7_000);
    expect(titles(visibleListRows(top, statsOf, newestFirst))).toEqual(["n", "b", "a"]);
  });

  it("une attente d'IMPORT posée en tête prend toujours la date de sa place", () => {
    const top = [waiting("n"), lib("a")];
    expect(makeStatsOf({ byEntry, pending: [importedAsk("n", 7_000)], natural: top })(waiting("n"))?.addedAt).toBe(1_000);
  });
});
