/**
 * La tenue à jour des playlists gardées : ajout gardé, retrait retiré (sauf
 * retenu ailleurs), copie d'ailleurs remplacée par Jellyfin APRÈS l'arrivée de
 * la nouvelle, forme du serveur changée, et ce qui n'a pas été relu intact.
 */

import { describe, expect, it } from "vitest";
import type { KeptMusicCollection, KeptMusicTrack } from "../core/musicLibrary";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { currentOf, holdKey, isHeld, planSync, type SyncInputs } from "./syncPlan";

function track(key: string, partial: Partial<MusicTrack> = {}): MusicTrack {
  const library = key.startsWith("jf:");
  return {
    key, jellyfinId: library ? key.slice(3) : null, external: library ? null : { pluginId: "musique", id: key.split(":").slice(2).join(":") },
    title: key, artists: [], album: null, durationMs: 1000, trackNumber: null, discNumber: null, year: null, artworkUrl: null,
    mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: library ? "library" : "remote", format: null, favorite: false,
    ...partial,
  };
}

let nextId = 1;
function kept(key: string, partial: Partial<KeptMusicTrack> = {}): KeptMusicTrack {
  return {
    fileId: nextId++, itemId: key, trackKey: key, origin: key.startsWith("jf:") ? "library" : "external", variant: "original", preset: null,
    status: "complete", errorCode: null, pausedByUser: false, bytesDone: 1, expectedSize: 1, title: key, artist: null, album: null, albumKey: null,
    discNumber: null, trackNumber: null, durationMs: 1000, coverRel: null, sourcePath: null, trackJson: JSON.stringify(track(key)), createdAt: 0,
    ...partial,
  };
}

const collection = (key: string, kind: KeptMusicCollection["kind"], trackKeys: string[]): KeptMusicCollection => ({
  key, kind, title: key, subtitle: null, coverItemId: null, trackKeys, updatedAt: 0,
});

function inputs(partial: Partial<SyncInputs>): SyncInputs {
  return { kept: [], collections: [], playlists: new Map(), twins: new Map(), wanted: new Map(), canKeep: () => true, ...partial };
}

const PL = "playlist:jf:p1";

describe("planSync — les playlists gardées", () => {
  it("rien de relu : rien ne change", () => {
    const out = planSync(inputs({ kept: [kept("jf:a")], collections: [collection(PL, "playlist", ["jf:a"])] }));
    expect(out).toEqual({ keep: [], removeFileIds: [], saveCollections: [], removeCollections: [] });
  });

  it("un titre ajouté à la playlist est gardé, la collection suit l'ordre de la playlist", () => {
    const out = planSync(inputs({
      kept: [kept("jf:a")],
      collections: [collection(PL, "playlist", ["jf:a"])],
      playlists: new Map([[PL, [track("jf:b"), track("jf:a")]]]),
    }));
    expect(out.keep.map((t) => t.key)).toEqual(["jf:b"]);
    expect(out.saveCollections).toEqual([expect.objectContaining({ key: PL, trackKeys: ["jf:b", "jf:a"] })]);
    expect(out.removeFileIds).toEqual([]);
  });

  it("un titre retiré de la playlist quitte l'appareil, sauf si un album, une autre playlist ou un geste le retient", () => {
    const a = kept("jf:a");
    const b = kept("jf:b");
    const c = kept("jf:c");
    const out = planSync(inputs({
      kept: [a, b, c],
      collections: [
        collection(PL, "playlist", ["jf:a", "jf:b", "jf:c"]),
        collection("album:jf:x", "album", ["jf:b"]),
        collection(holdKey("jf:c"), "track", ["jf:c"]),
      ],
      playlists: new Map([[PL, []]]),
    }));
    expect(out.removeFileIds).toEqual([a.fileId]);
  });

  it("Damien, 26/10 : retiré de la playlist tenue à jour, le titre est EFFACÉ de l'appareil — sauf si un album ou une autre playlist le garde", () => {
    const alone = kept("jf:seul");
    const other = kept("jf:autre");
    const albumed = kept("jf:album");
    const out = planSync(inputs({
      kept: [alone, other, albumed],
      collections: [
        collection(PL, "playlist", ["jf:seul", "jf:autre", "jf:album"]),
        collection("playlist:jf:p2", "playlist", ["jf:autre"]),
        collection("album:jf:x", "album", ["jf:album"]),
      ],
      playlists: new Map([[PL, []]]),
    }));
    expect(out.removeFileIds).toEqual([alone.fileId]);
    expect(out.keep).toEqual([]);
    expect(out.saveCollections).toEqual([expect.objectContaining({ key: PL, trackKeys: [] })]);
  });

  it("le titre ajouté qu'on ne peut pas garder (droit de l'extension) ne part pas", () => {
    const out = planSync(inputs({
      collections: [collection(PL, "playlist", [])],
      playlists: new Map([[PL, [track("ext:musique:ytm:t:x")]]]),
      canKeep: (t) => t.jellyfinId !== null,
    }));
    expect(out.keep).toEqual([]);
  });
});

describe("planSync — la version Jellyfin remplace la copie d'ailleurs", () => {
  const EXT = "ext:musique:ytm:t:x";
  const twins = new Map([[EXT, track("jf:z")]]);

  it("tant que la version Jellyfin n'est pas complète : elle est gardée, l'ancienne copie RESTE", () => {
    const old = kept(EXT);
    const first = planSync(inputs({ kept: [old], collections: [collection(PL, "playlist", [EXT])], twins }));
    expect(first.keep.map((t) => t.key)).toEqual(["jf:z"]);
    expect(first.removeFileIds).toEqual([]);
    const pending = planSync(inputs({ kept: [old, kept("jf:z", { status: "downloading" })], collections: [collection(PL, "playlist", [EXT])], twins }));
    expect(pending).toEqual({ keep: [], removeFileIds: [], saveCollections: [], removeCollections: [] });
  });

  it("complète : l'ancienne copie part, les collections et la retenue passent à la clé Jellyfin", () => {
    const old = kept(EXT);
    const out = planSync(inputs({
      kept: [old, kept("jf:z")],
      collections: [collection(PL, "playlist", [EXT]), collection(holdKey(EXT), "track", [EXT])],
      twins,
    }));
    expect(out.removeFileIds).toEqual([old.fileId]);
    expect(out.keep).toEqual([]);
    expect(out.saveCollections.map((c) => [c.key, c.trackKeys])).toEqual([[PL, ["jf:z"]], [holdKey("jf:z"), ["jf:z"]]]);
    expect(out.removeCollections).toEqual([holdKey(EXT)]);
  });

  it("une playlist d'ailleurs relue garde la clé Jellyfin, sans retirer le titre", () => {
    const old = kept(EXT);
    const out = planSync(inputs({
      kept: [old],
      collections: [collection("playlist:ext:musique:pl", "playlist", [EXT])],
      playlists: new Map([["playlist:ext:musique:pl", [track(EXT)]]]),
      twins,
    }));
    expect(out.keep.map((t) => t.key)).toEqual(["jf:z"]);
    expect(out.removeFileIds).toEqual([]);
    expect(out.saveCollections[0]!.trackKeys).toEqual(["jf:z"]);
  });
});

describe("planSync — une identité qui change chez l'extension (imp: → ytm:t:)", () => {
  const OLD = "ext:musique:imp:r";
  const NOW = "ext:musique:ytm:t:v";

  it("la chaîne est suivie jusqu'à la bibliothèque, sans boucle", () => {
    const chain = new Map([[OLD, track(NOW)], [NOW, track("jf:z")]]);
    expect(currentOf(chain, OLD)?.key).toBe("jf:z");
    expect(currentOf(chain, "jf:z")).toBeNull();
    expect(currentOf(new Map([[OLD, track(NOW)], [NOW, track(OLD)]]), OLD)?.key).toBe(NOW);
  });

  it("gardé sous la clé d'hier, déjà gardé sous celle d'aujourd'hui (à la main) : la copie d'hier part, la retenue reste", () => {
    const old = kept(OLD);
    const now = kept(NOW);
    const out = planSync(inputs({
      kept: [old, now],
      collections: [collection(PL, "playlist", ["jf:a", OLD]), collection(holdKey(NOW), "track", [NOW])],
      twins: new Map([[OLD, track(NOW)]]),
    }));
    expect(out.removeFileIds).toEqual([old.fileId]);
    expect(out.keep).toEqual([]);
    expect(out.saveCollections.map((c) => [c.key, c.trackKeys])).toEqual([[PL, ["jf:a", NOW]]]);
  });

  it("imp: → ytm:t: → jf: d'un coup : c'est la version Jellyfin qui est gardée", () => {
    const out = planSync(inputs({ kept: [kept(OLD)], collections: [collection(PL, "playlist", [OLD])], twins: new Map([[OLD, track(NOW)], [NOW, track("jf:z")]]) }));
    expect(out.keep.map((t) => t.key)).toEqual(["jf:z"]);
    expect(out.removeFileIds).toEqual([]);
  });
});

describe("planSync — la forme voulue par le serveur", () => {
  it("l'Allégé allumé : la nouvelle forme est gardée, l'original part une fois elle complète", () => {
    const original = kept("jf:a");
    const wanted = new Map([["jf:a", { variant: "light" as const, preset: "a256" }]]);
    const first = planSync(inputs({ kept: [original], wanted }));
    expect(first.keep.map((t) => t.key)).toEqual(["jf:a"]);
    expect(first.removeFileIds).toEqual([]);
    const light = kept("jf:a", { variant: "light", preset: "a256" });
    expect(planSync(inputs({ kept: [original, { ...light, status: "queued" }], wanted })).removeFileIds).toEqual([]);
    expect(planSync(inputs({ kept: [original, light], wanted })).removeFileIds).toEqual([original.fileId]);
  });

  it("déjà dans la bonne forme : rien", () => {
    const out = planSync(inputs({ kept: [kept("jf:a")], wanted: new Map([["jf:a", { variant: "original" as const, preset: null }]]) }));
    expect(out.keep).toEqual([]);
    expect(out.removeFileIds).toEqual([]);
  });
});

describe("isHeld", () => {
  it("hors la collection qu'on retire", () => {
    const cs = [collection(PL, "playlist", ["jf:a"]), collection("album:jf:x", "album", ["jf:a"])];
    expect(isHeld("jf:a", cs, PL)).toBe(true);
    expect(isHeld("jf:a", cs.slice(0, 1), PL)).toBe(false);
  });
});
