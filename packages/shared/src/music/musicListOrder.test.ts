import { describe, expect, it } from "vitest";
import {
  applyCustomOrder,
  customEntriesOf,
  defaultDirection,
  defaultListPrefs,
  parseListKey,
  parseListPrefs,
  sortListItems,
  type MusicListPrefs,
  type MusicListSubject,
} from "./musicListOrder";

function s(key: string, extra: Partial<MusicListSubject> = {}): MusicListSubject {
  return { key, title: key, artist: "", album: "", disc: null, track: null, durationMs: null, year: null, recording: null, stats: null, ...extra };
}
const id = (x: MusicListSubject) => x;
const keys = (list: MusicListSubject[]) => list.map((x) => x.key);
const prefs = (sort: MusicListPrefs["sort"], direction: MusicListPrefs["direction"] = defaultDirection(sort)): MusicListPrefs => ({ sort, direction, custom: null });

describe("tri d'une liste de titres", () => {
  it("par titre, sans tenir compte des accents ni de la casse, les nombres dans l'ordre", () => {
    const list = [s("b", { title: "Été" }), s("a", { title: "abba" }), s("c", { title: "Track 10" }), s("d", { title: "Track 9" })];
    expect(keys(sortListItems(list, id, prefs("title")))).toEqual(["a", "b", "d", "c"]);
    expect(keys(sortListItems(list, id, prefs("title", "desc")))).toEqual(["c", "d", "b", "a"]);
  });

  it("par artiste : puis album, puis l'ordre des pistes", () => {
    const list = [
      s("x2", { artist: "Air", album: "Moon Safari", track: 2 }),
      s("y", { artist: "Zola", album: "A" }),
      s("x1", { artist: "air", album: "Moon Safari", track: 1 }),
      s("w", { artist: "Air", album: "10 000 Hz", track: 5 }),
    ];
    expect(keys(sortListItems(list, id, prefs("artist")))).toEqual(["w", "x1", "x2", "y"]);
  });

  it("par album, durée, année : une valeur absente toujours à la fin, dans les deux sens", () => {
    const list = [s("a", { durationMs: 200 }), s("b"), s("c", { durationMs: 100 })];
    expect(keys(sortListItems(list, id, prefs("duration", "asc")))).toEqual(["c", "a", "b"]);
    expect(keys(sortListItems(list, id, prefs("duration", "desc")))).toEqual(["a", "c", "b"]);
    const years = [s("a", { year: 1999 }), s("b"), s("c", { year: 2020 })];
    expect(keys(sortListItems(years, id, prefs("year")))).toEqual(["c", "a", "b"]);
  });

  it("dernier ajout, plus écoutés, écoutés récemment", () => {
    const st = (addedAt: number | null, plays: number, lastPlayedAt: number | null) => ({ stats: { addedAt, plays, lastPlayedAt } });
    const list = [s("a", st(10, 5, 100)), s("b", st(30, 0, null)), s("c", st(20, 5, 300))];
    expect(keys(sortListItems(list, id, prefs("added")))).toEqual(["b", "c", "a"]);
    expect(keys(sortListItems(list, id, prefs("added", "asc")))).toEqual(["a", "c", "b"]);
    // Ex æquo d'écoutes : la plus récente d'abord.
    expect(keys(sortListItems(list, id, prefs("plays")))).toEqual(["c", "a", "b"]);
    expect(keys(sortListItems(list, id, prefs("lastPlayed")))).toEqual(["c", "a", "b"]);
  });

  it("les ex æquo gardent l'ordre naturel (tri stable)", () => {
    const list = [s("a", { artist: "X" }), s("b", { artist: "X" }), s("c", { artist: "X" })];
    expect(keys(sortListItems(list, id, prefs("artist")))).toEqual(["a", "b", "c"]);
  });

  it("dernier ajout à date égale : plus bas dans la liste = ajouté après (un import, une arrivée posée à sa place)", () => {
    const at = (addedAt: number | null) => ({ stats: { addedAt, plays: 0, lastPlayedAt: null } });
    // La playlist importée de Damien : a, b, c d'un même import ; x arrivé de Lidarr à la place de son attente (date de a).
    const list = [s("a", at(10)), s("x", at(10)), s("b", at(11)), s("c", at(11)), s("n", at(50))];
    expect(keys(sortListItems(list, id, prefs("added")))).toEqual(["n", "c", "b", "x", "a"]);
    expect(keys(sortListItems(list, id, prefs("added", "asc")))).toEqual(["a", "x", "b", "c", "n"]);
    // Aucune date du tout : l'ordre naturel inversé, jamais l'ordre naturel.
    const undated = [s("a"), s("b"), s("c")];
    expect(keys(sortListItems(undated, id, prefs("added")))).toEqual(["c", "b", "a"]);
  });
});

describe("ordre personnalisé", () => {
  it("sans ordre gardé : l'ordre naturel", () => {
    const list = [s("a"), s("b")];
    expect(keys(sortListItems(list, id, { sort: "custom", direction: "asc", custom: null }))).toEqual(["a", "b"]);
  });

  it("l'ordre gardé fait foi ; un nouveau titre se pose après son prédécesseur naturel, en tête sans prédécesseur", () => {
    const natural = [s("new-like"), s("a"), s("b"), s("added"), s("c")];
    const custom = [{ k: "c" }, { k: "a" }, { k: "b" }];
    expect(keys(applyCustomOrder(natural, id, custom))).toEqual(["new-like", "c", "a", "b", "added"]);
  });

  it("un titre en attente devenu « bibliothèque » garde sa place par son MBID d'enregistrement", () => {
    const custom = [{ k: "jf:1" }, { k: "ext:sillon:ytm:t:zz", r: "rec-1" }, { k: "jf:2" }];
    const natural = [s("jf:1"), s("jf:2"), s("jf:9", { recording: "rec-1" })];
    expect(keys(applyCustomOrder(natural, id, custom))).toEqual(["jf:1", "jf:9", "jf:2"]);
  });

  it("le MBID n'hérite pas d'une attente encore présente", () => {
    const custom = [{ k: "ext:p", r: "rec" }, { k: "jf:1" }];
    const natural = [s("jf:1"), s("ext:p", { recording: "rec" }), s("jf:2", { recording: "rec" })];
    expect(keys(applyCustomOrder(natural, id, custom))).toEqual(["ext:p", "jf:2", "jf:1"]);
  });

  it("l'ordre affiché devient l'ordre gardé, une attente avec son MBID", () => {
    const shown = [s("jf:1", { recording: "r1" }), s("ext:x", { recording: "r2" }), s("jf:1")];
    expect(customEntriesOf(shown, (x) => x.key.startsWith("ext:"))).toEqual([{ k: "jf:1" }, { k: "ext:x", r: "r2" }]);
  });

  it("1 000 titres : tri et ordre personnalisé en quelques millisecondes", () => {
    const list = Array.from({ length: 1000 }, (_, i) => s(`k${i}`, { title: `Titre ${(i * 7919) % 1000}`, artist: `Artiste ${i % 37}`, stats: { addedAt: i, plays: i % 13, lastPlayedAt: null } }));
    const custom = [...list].reverse().map((x) => ({ k: x.key }));
    const t0 = performance.now();
    for (const sort of ["title", "artist", "added", "plays"] as const) sortListItems(list, id, prefs(sort));
    const reordered = applyCustomOrder(list, id, custom);
    const elapsed = performance.now() - t0;
    expect(reordered[0]!.key).toBe("k999");
    expect(elapsed).toBeLessThan(200);
  });
});

describe("contrat de la préférence", () => {
  it("clés de liste", () => {
    expect(parseListKey("liked")).toBe("liked");
    expect(parseListKey("playlist:ABCDEF01-2345-6789-abcd-ef0123456789")).toBe("playlist:abcdef0123456789abcdef0123456789");
    expect(parseListKey("playlist:../etc")).toBeNull();
    expect(parseListKey(3)).toBeNull();
  });

  it("par défaut : la playlist dans son ordre, les likés au dernier like", () => {
    expect(defaultListPrefs("liked")).toEqual({ sort: "added", direction: "desc", custom: null });
    expect(defaultListPrefs("playlist:x" as never).sort).toBe("custom");
  });

  it("validation", () => {
    expect(parseListPrefs({ sort: "title", direction: "asc" })).toEqual({ sort: "title", direction: "asc", custom: null });
    expect(parseListPrefs({ sort: "custom", direction: "asc", custom: [{ k: "jf:1" }, { k: "ext:a", r: "m" }] })?.custom).toHaveLength(2);
    expect(parseListPrefs({ sort: "nope", direction: "asc" })).toBeNull();
    expect(parseListPrefs({ sort: "title", direction: "up" })).toBeNull();
    expect(parseListPrefs({ sort: "custom", direction: "asc", custom: [{ k: "" }] })).toBeNull();
    expect(parseListPrefs({ sort: "custom", direction: "asc", custom: Array.from({ length: 10_001 }, () => ({ k: "a" })) })).toBeNull();
  });
});

describe("ordre personnalisé d'une playlist partagée (nouveaux titres à la fin)", () => {
  const keys = (list: MusicListSubject[]) => list.map((x) => x.key);

  it("un titre ajouté par un autre entre à la FIN de mon ordre, pas après son prédécesseur", () => {
    // Mon ordre : c, a, b ; un autre a ajouté x puis y (au bout de la playlist Jellyfin).
    const natural = [s("a"), s("b"), s("c"), s("x"), s("y")];
    const custom = [{ k: "c" }, { k: "a" }, { k: "b" }];
    expect(keys(applyCustomOrder(natural, id, custom, "end"))).toEqual(["c", "a", "b", "x", "y"]);
    // Le défaut d'avant : x suit c (son prédécesseur naturel), en plein milieu.
    expect(keys(applyCustomOrder(natural, id, [{ k: "b" }, { k: "c" }, { k: "a" }]))).toEqual(["b", "c", "x", "y", "a"]);
  });

  it("sans ordre gardé, l'ordre naturel (ajouts au bout) fait foi", () => {
    const natural = [s("a"), s("b"), s("x")];
    expect(keys(sortListItems(natural, id, { sort: "custom", direction: "asc", custom: null }, "end"))).toEqual(["a", "b", "x"]);
  });

  it("un titre que j'ai placé garde sa place même s'il arrive tard dans l'ordre naturel", () => {
    const natural = [s("a"), s("x"), s("b")];
    expect(keys(sortListItems(natural, id, { sort: "custom", direction: "asc", custom: [{ k: "b" }, { k: "a" }] }, "end"))).toEqual(["b", "a", "x"]);
  });
});
