import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicAlbum, MusicArtist } from "@tentacle-tv/shared/music";
import { readRecentVisits, recordVisit, visitOf, withVisit, VISITS_MAX } from "./recentVisits";
import { buildRecentShelves } from "./recentShelves";

const album = (key: string, jellyfinId: string | null = null) => ({ key, jellyfinId, title: key, tracks: [{ key: "t" }] }) as unknown as MusicAlbum;
const artist = (key: string, jellyfinId: string | null = null) => ({ key, jellyfinId, name: key, topTracks: [], albums: [] }) as unknown as MusicArtist;

describe("recentVisits", () => {
  const disk = new Map<string, string>();
  beforeEach(() => {
    disk.clear();
    vi.stubGlobal("localStorage", { getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v) });
  });

  it("garde l'album sans ses titres, l'artiste sans ses titres ni albums", () => {
    expect(visitOf("album", album("a"), 1).item).not.toHaveProperty("tracks");
    const v = visitOf("artist", artist("b"), 1).item;
    expect(v).not.toHaveProperty("topTracks");
    expect(v).not.toHaveProperty("albums");
  });

  it("la page rouverte passe en tête, une fois ; la liste est bornée", () => {
    let list = withVisit([], visitOf("album", album("a"), 1));
    list = withVisit(list, visitOf("artist", artist("b"), 2));
    list = withVisit(list, visitOf("album", album("a"), 3));
    expect(list.map((v) => v.item.key)).toEqual(["a", "b"]);
    for (let i = 0; i < 30; i++) list = withVisit(list, visitOf("album", album(`x${i}`), i));
    expect(list).toHaveLength(VISITS_MAX);
  });

  it("chaque identité a ses pages", () => {
    recordVisit(visitOf("album", album("a"), 1), "srv|u1");
    recordVisit(visitOf("album", album("b"), 2), "srv|u2");
    expect(readRecentVisits("srv|u1").map((v) => v.item.key)).toEqual(["a"]);
    expect(readRecentVisits("srv|u2").map((v) => v.item.key)).toEqual(["b"]);
    expect(readRecentVisits(null)).toEqual([]);
  });

  it("un stockage abîmé ne casse rien", () => {
    disk.set("tentacle_octave_recent_visits", "{pas du json");
    expect(readRecentVisits("srv|u1")).toEqual([]);
  });
});

describe("buildRecentShelves", () => {
  it("les pages ouvertes d'abord, puis les écoutes du compte, sans doublon", () => {
    const visits = [visitOf("album", album("jf:1", "1"), 3), visitOf("artist", artist("ext:p:ar:9"), 2)];
    const shelves = buildRecentShelves(visits, { recentAlbums: [album("jf:1", "1"), album("jf:2", "2")], recentArtists: [artist("jf:5", "5")] });
    expect(shelves.albums.map((a) => a.key)).toEqual(["jf:1", "jf:2"]);
    expect(shelves.artists.map((a) => a.key)).toEqual(["ext:p:ar:9", "jf:5"]);
  });

  it("sans rien : des rangées vides", () => {
    expect(buildRecentShelves([], undefined)).toEqual({ albums: [], artists: [] });
  });
});
