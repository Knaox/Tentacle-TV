import { describe, expect, it } from "vitest";
import type { MusicListPrefs } from "../../music";
import {
  deferOrderWrite,
  enqueueOrderWrite,
  parseOrderQueue,
  pendingListPrefs,
  replayListPrefs,
  replayPlaylistOrder,
  replayShelfOrder,
  settleOrderWrite,
  type ListPrefsWrite,
  type PlaylistOrderWrite,
} from "./orderOutbox";

const custom = (keys: string): MusicListPrefs => ({ sort: "custom", direction: "asc", custom: keys.split("").map((k) => ({ k })) });
const prefsWrite = (keys: string, base: string | null): ListPrefsWrite => ({ kind: "listPrefs", key: "playlist:p1", prefs: custom(keys), base: base === null ? null : base.split("") });
const keysOf = (prefs: MusicListPrefs) => prefs.custom?.map((e) => e.k).join("");

describe("la file d'envoi", () => {
  it("une écriture par cible : la dernière gagne, la base du premier geste reste", () => {
    let queue = enqueueOrderWrite([], prefsWrite("bac", "abc"), 1);
    queue = enqueueOrderWrite(queue, prefsWrite("cba", "bac"), 2);
    expect(queue).toHaveLength(1);
    expect(keysOf((queue[0]!.write as ListPrefsWrite).prefs)).toBe("cba");
    expect((queue[0]!.write as ListPrefsWrite).base).toEqual(["a", "b", "c"]);
    expect(queue[0]!.seq).toBe(2);
  });
  it("un envoi réussi ne retire pas un geste plus récent", () => {
    let queue = enqueueOrderWrite([], prefsWrite("bac", "abc"), 1);
    queue = enqueueOrderWrite(queue, prefsWrite("cba", "bac"), 2);
    expect(settleOrderWrite(queue, "prefs:playlist:p1", 1)).toHaveLength(1);
    expect(settleOrderWrite(queue, "prefs:playlist:p1", 2)).toHaveLength(0);
  });
  it("un échec réseau marque l'écriture à rejouer par fusion, et la marque reste", () => {
    let queue = deferOrderWrite(enqueueOrderWrite([], prefsWrite("bac", "abc"), 1), "prefs:playlist:p1");
    queue = enqueueOrderWrite(queue, prefsWrite("cba", "bac"), 2);
    expect(queue[0]!.deferred).toBe(true);
  });
  it("relue du disque : ce qui est mal formé est ignoré", () => {
    const good = enqueueOrderWrite([], prefsWrite("ab", "ab"), 1)[0];
    expect(parseOrderQueue([good, { target: 1 }, null, "x"])).toEqual([good]);
    expect(parseOrderQueue("garbage")).toEqual([]);
  });
  it("la préférence en attente se lit par clé", () => {
    const queue = enqueueOrderWrite([], prefsWrite("ba", "ab"), 1);
    expect(keysOf(pendingListPrefs(queue, "playlist:p1")!)).toBe("ba");
    expect(pendingListPrefs(queue, "liked")).toBeNull();
  });
});

describe("replayListPrefs", () => {
  it("serveur inchangé (jamais réordonné) : l'ordre hors ligne tel quel", () => {
    const remote: MusicListPrefs = { sort: "title", direction: "asc", custom: null };
    expect(replayListPrefs(prefsWrite("cab", "abc"), remote)).toEqual(custom("cab"));
  });
  it("réordonné ailleurs pendant ce temps : fusion, le geste hors ligne gagne sur ce qu'il a touché", () => {
    // Hors ligne : « e » en tête. Ailleurs : « b » et « c » échangés.
    expect(keysOf(replayListPrefs(prefsWrite("eabcd", "abcde"), custom("acbde")))).toBe("eacbd");
  });
  it("seul le tri a changé hors ligne : le tri part, l'ordre personnalisé du serveur reste", () => {
    const write: ListPrefsWrite = { kind: "listPrefs", key: "liked", prefs: { sort: "title", direction: "desc", custom: [{ k: "a" }] }, base: null };
    expect(replayListPrefs(write, custom("ba"))).toEqual({ sort: "title", direction: "desc", custom: [{ k: "b" }, { k: "a" }] });
  });
  it("garde l'identité d'une attente (`r`)", () => {
    const write: ListPrefsWrite = { kind: "listPrefs", key: "playlist:p1", prefs: { sort: "custom", direction: "asc", custom: [{ k: "b", r: "mbid" }, { k: "a" }] }, base: ["a", "b"] };
    expect(replayListPrefs(write, custom("ab")).custom).toEqual([{ k: "b", r: "mbid" }, { k: "a" }]);
  });
});

describe("replayPlaylistOrder", () => {
  const write = (keys: string, base: string): PlaylistOrderWrite => ({ kind: "playlistOrder", playlistId: "p1", entryIds: [], keys: keys.split(""), base: base.split("") });
  const fresh = (keys: string) => keys.split("").map((key, i) => ({ entryId: `e${i}-${key}`, key }));

  it("mappe l'ordre voulu sur les entrées d'AUJOURD'HUI (Jellyfin les a réécrites)", () => {
    expect(replayPlaylistOrder(write("cab", "abc"), fresh("abc"))).toEqual(["e2-c", "e0-a", "e1-b"]);
  });
  it("déjà dans cet ordre : rien à envoyer", () => {
    expect(replayPlaylistOrder(write("cab", "abc"), fresh("cab"))).toBeNull();
  });
  it("un titre ajouté et un retiré ailleurs : fusion", () => {
    expect(replayPlaylistOrder(write("dabc", "abcd"), fresh("abxd"))).toEqual(["e3-d", "e0-a", "e1-b", "e2-x"]);
  });
  it("un doublon garde ses deux entrées", () => {
    expect(replayPlaylistOrder(write("aba", "aab"), fresh("aab"))).toEqual(["e0-a", "e2-b", "e1-a"]);
  });
});

describe("replayShelfOrder", () => {
  it("fusionne l'ordre de la rubrique", () => {
    expect(replayShelfOrder({ kind: "shelfOrder", section: "playlists", keys: ["c", "a", "b"], base: ["a", "b", "c"] }, ["a", "b", "c", "n"])).toEqual(["c", "a", "b", "n"]);
  });
});
