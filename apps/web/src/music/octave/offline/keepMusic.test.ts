/**
 * Garder un lot : le plan du serveur pour la bibliothèque, la route de
 * l'extension pour le reste, la collection TOUJOURS entière (même quand le lot
 * n'en garde qu'une partie), et le compte de l'appareil.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicTrack } from "@tentacle-tv/shared/music";

const h = vi.hoisted(() => ({ invoked: [] as { command: string; args: Record<string, unknown> }[], planned: [] as unknown[] }));

vi.mock("../../../desktop/bridge", () => ({
  invoke: async (command: string, args: Record<string, unknown>) => {
    h.invoked.push({ command, args });
    return { accepted: true, neededBytes: 0 };
  },
  listen: async () => () => undefined,
}));
vi.mock("../../../lib/backendBase", () => ({ getBackendBase: () => "http://serveur.test" }));
vi.mock("../../../offline/offlineOwner", () => ({ readOfflineOwner: () => ({ userId: "compte", token: "jeton" }) }));
vi.mock("./keptMusicStore", () => ({ refreshKeptMusic: async () => undefined }));
vi.mock("@tentacle-tv/api-client", () => ({
  musicRouteUrl: (p: { pluginId: string }, path: string) => `/api/plugins/${p.pluginId}${path}`,
  tentacleApiFetch: async (_path: string, init: { body: string }) => {
    h.planned.push(JSON.parse(init.body));
    return { tracks: [{ id: "aa", variant: "light", preset: "a256", path: "/api/downloads/light/aa?preset=a256", container: "m4a", expectedSize: null, estimatedSize: 1000 }], refused: [] };
  },
}));

import { keepTracks } from "./keepMusic";

function track(partial: Partial<MusicTrack>): MusicTrack {
  return {
    key: "jf:aa", jellyfinId: "aa", external: null, title: "T", artists: [{ name: "A", mbid: null, jellyfinId: null }], album: null,
    durationMs: 1000, trackNumber: 1, discNumber: 1, year: null, artworkUrl: "/api/music/artwork/aa", mbids: { recording: null, release: null, releaseGroup: null, artists: [] },
    availability: "library", format: null, favorite: false, ...partial,
  };
}

const PROVIDER = { pluginId: "musique", name: "M", music: { search: "/s", resolve: "/r", offline: "/music/offline" } };

beforeEach(() => {
  h.invoked = [];
  h.planned = [];
});

describe("keepTracks", () => {
  it("la bibliothèque selon le plan du serveur, l'ailleurs par la route de l'extension, au nom du compte de l'appareil", async () => {
    const elsewhere = track({ key: "ext:musique:ytm:t:x", jellyfinId: null, external: { pluginId: "musique", id: "ytm:t:x" }, availability: "remote", artworkUrl: "https://ailleurs.test/a.jpg" });
    const outcome = await keepTracks([track({}), elsewhere], PROVIDER, null);
    expect(outcome).toEqual({ kind: "queued", count: 2, refused: 0 });
    expect(h.planned).toEqual([{ ids: ["aa"] }]);
    const call = h.invoked[0]!;
    expect(call.command).toBe("downloads_music_enqueue");
    expect(call.args).toMatchObject({ userId: "compte", token: "jeton", serverUrl: "http://serveur.test" });
    const items = call.args.items as { sourcePath: string; artworkPath: string | null; variant: string }[];
    expect(items[0]).toMatchObject({ sourcePath: "/api/downloads/light/aa?preset=a256", variant: "light", artworkPath: "/api/music/artwork/aa" });
    // Une pochette d'un autre hôte ne se garde pas avec le jeton.
    expect(items[1]).toMatchObject({ sourcePath: "/api/plugins/musique/music/offline/ytm%3At%3Ax", variant: "original", artworkPath: null });
  });

  it("une collection garde TOUS ses titres, même quand le lot n'en garde qu'un (les titres qui manquent)", async () => {
    await keepTracks([track({})], PROVIDER, { key: "album:jf:x", kind: "album", title: "X", subtitle: null, trackKeys: ["jf:zz", "jf:aa", "jf:yy"] });
    expect(h.invoked[0]!.args.collection).toMatchObject({ key: "album:jf:x", trackKeys: ["jf:zz", "jf:aa", "jf:yy"] });
  });

  it("un titre d'ailleurs sans route offline de l'extension ne part pas", async () => {
    const elsewhere = track({ key: "ext:musique:x", jellyfinId: null, external: { pluginId: "musique", id: "x" }, availability: "remote" });
    expect(await keepTracks([elsewhere], { ...PROVIDER, music: { search: "/s", resolve: "/r" } }, null)).toEqual({ kind: "failed" });
    expect(h.invoked).toEqual([]);
  });
});
