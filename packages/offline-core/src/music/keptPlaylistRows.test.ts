import { describe, expect, it } from "vitest";
import type { ListRow } from "@tentacle-tv/shared/octave";
import { externalTrack, libraryTrack } from "@tentacle-tv/shared/octave/testing";
import { keptPlaylistRows, type KeptEntry } from "./keptPlaylistRows";

/**
 * Octave — « le mode hors ligne de la playlist, c'est la playlist, mais en version hors ligne, littéralement une
 * copie » (Damien, 28/10) : l'ordre, les doublons et l'identité des rangées en ligne ; la copie gardée dans chacune.
 */
const a = libraryTrack("a");
const b = externalTrack("sillon", "imp:b");
const c = libraryTrack("c");
const d = libraryTrack("d");
const copy = (track: typeof a, key = track.key): KeptEntry => ({ key, track: { ...track, artworkUrl: `local:${track.key}` } });
const entryRow = (track: typeof a, entryId: string): ListRow => ({ rowKey: entryId, track, pending: null, entryId });
const pendingRow = (track: typeof a, op: string): ListRow => ({ rowKey: `pending:${op}`, track, pending: { operationId: op, failed: false, note: null }, entryId: null });
const keys = (rows: ListRow[]) => rows.map((r) => r.rowKey);

describe("une playlist gardée = la playlist en ligne", () => {
  it("l'ordre en ligne fait foi, même si la collection gardée l'a dans un autre ordre (gardée avant le 28/10)", () => {
    const online = [entryRow(a, "e1"), pendingRow(b, "op-b"), entryRow(c, "e3")];
    const rows = keptPlaylistRows([copy(c), copy(a), copy(b)], online);
    expect(keys(rows)).toEqual(["e1", "pending:op-b", "e3"]);
    // L'identité de la rangée en ligne (entrée, attente) : les dates de « Date d'ajout » la suivent.
    expect(rows[1]!.pending?.operationId).toBe("op-b");
    // … et la copie gardée dedans : pochette locale, lecture depuis le disque.
    expect(rows.map((r) => r.track.artworkUrl)).toEqual([`local:${a.key}`, `local:${b.key}`, `local:${c.key}`]);
  });

  it("une rangée en ligne sans copie sur l'appareil n'est pas là ; un doublon en ligne reste un doublon", () => {
    const online = [entryRow(a, "e1"), entryRow(d, "e2"), entryRow(a, "e3")];
    expect(keys(keptPlaylistRows([copy(a)], online))).toEqual(["e1", "e3"]);
  });

  it("un titre arrivé dans la bibliothèque garde sa place (son attente devient l'entrée, au même rang)", () => {
    const arrived = libraryTrack("b-jf");
    const before = keptPlaylistRows([copy(a), copy(b), copy(c)], [entryRow(a, "e1"), pendingRow(b, "op-b"), entryRow(c, "e3")]);
    const after = keptPlaylistRows([copy(a), copy(arrived), copy(c)], [entryRow(a, "e1"), entryRow(arrived, "e2"), entryRow(c, "e3")]);
    expect(before.map((r) => r.track.title)).toEqual(after.map((r) => r.track.title === arrived.title ? b.title : r.track.title));
    expect(keys(after)).toEqual(["e1", "e2", "e3"]);
  });

  it("une copie renommée depuis (clé d'aujourd'hui ≠ clé du fichier) se reconnaît à l'une ou l'autre", () => {
    const renamed = copy(b, "ext:sillon:ytm:t:b");
    expect(keys(keptPlaylistRows([renamed], [pendingRow({ ...b, key: "ext:sillon:ytm:t:b" }, "op-b")]))).toEqual(["pending:op-b"]);
    expect(keys(keptPlaylistRows([renamed], [pendingRow(b, "op-b")]))).toEqual(["pending:op-b"]);
  });

  it("un titre gardé que la playlist en ligne ne connaît pas (cache d'avant) : après son prédécesseur gardé", () => {
    const online = [entryRow(a, "e1"), entryRow(c, "e3")];
    expect(keys(keptPlaylistRows([copy(a), copy(b), copy(c)], online))).toEqual(["e1", b.key, "e3"]);
    expect(keys(keptPlaylistRows([copy(d), copy(a), copy(c)], online))).toEqual([d.key, "e1", "e3"]);
  });

  it("sans rangées en ligne (playlist d'ailleurs, rien en cache) : l'ordre de la collection gardée", () => {
    expect(keys(keptPlaylistRows([copy(c), copy(a)], null))).toEqual([c.key, a.key]);
    expect(keys(keptPlaylistRows([copy(c), copy(a)], []))).toEqual([c.key, a.key]);
  });
});
