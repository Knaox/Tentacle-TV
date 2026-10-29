import { afterEach, describe, expect, it } from "vitest";
import { createHostDispatcher } from "./hostDispatcher";
import { HOST_HANDLERS } from "./host/hostHandlers";
import { configureIsolatedRuntime, resetRuntimeServicesForTests, type JellyfinMusicHost, type RuntimeMusicEvent } from "./hostServices";
import type { HostToGuest, PluginRuntimeManifest } from "./pluginServerRuntime";

/**
 * Les services EMPRUNTÉS à la musique du cœur (`jellyfin.*`, envoi des
 * événements), branchés derrière la porte de l'API d'hôte : sans service,
 * `unavailable` ; un refus du service (son `code`) passe tel quel ; une
 * extension n'émet que ses deux types, à la forme du contrat, en SON nom.
 */

const manifest: PluginRuntimeManifest = { kind: "isolated", entry: "x.mjs", hostApi: ["jellyfin.music", "events"] };
const dispatch = createHostDispatcher({ pluginId: "sillon", manifest, pluginDir: "/p", dataDir: "/p/data" }, HOST_HANDLERS);

function call(method: string, params: unknown): Promise<Extract<HostToGuest, { t: "result" }>> {
  return new Promise((done) => dispatch({ t: "call", id: 1, method: method as never, params }, (out) => done(out as Extract<HostToGuest, { t: "result" }>)));
}

class HostMusicFailure extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

const fakeJellyfin = (over: Partial<JellyfinMusicHost> = {}): JellyfinMusicHost => ({
  musicLibrary: async () => ({ libraryId: "lib", name: "Musique", paths: ["/music"] }),
  findByMbid: async ({ recordings }) => recordings.map((r) => ({ jellyfinId: `jf-${r.slice(0, 4)}`, recording: r, release: null, path: null })),
  matchTracks: async ({ tracks }) => tracks.map((t) => ({ ref: t.ref, item: { jellyfinId: "jf-titre", recording: null, release: null, path: null } })),
  setFavorite: async () => ({ ok: true }),
  playlistInsert: async () => ({ ok: true }),
  playlistEntries: async () => [],
  playlistEditable: async () => ({ editable: true }),
  usageOf: async () => [],
  notifyPath: async () => ({ ok: true }),
  refreshPath: async () => ({ ok: true, scope: "folder", itemId: "album" }),
  playlistSourceRemoved: async () => ({ ok: true, marked: true }),
  ...over,
});

const R = "2308b57c-a740-4750-b632-219cf70c5f1b";

afterEach(() => resetRuntimeServicesForTests());

describe("jellyfin.* derrière la porte", () => {
  it("sans musique du cœur branchée : unavailable, jamais une exception", async () => {
    expect(await call("jellyfin.findByMbid", { recordings: [R] })).toMatchObject({ ok: false, error: { code: "unavailable" } });
  });

  it("branchée : les paramètres validés arrivent, le résultat repart tel quel", async () => {
    configureIsolatedRuntime({ jellyfin: fakeJellyfin() });
    expect(await call("jellyfin.findByMbid", { recordings: [R] })).toMatchObject({ ok: true, value: [{ jellyfinId: "jf-2308", recording: R }] });
    expect(await call("jellyfin.findByMbid", { recordings: ["pas-un-mbid"] })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("matchTracks : un titre sans MBID (titre, artistes, durée) passe la porte ; bornes et formes tenues", async () => {
    configureIsolatedRuntime({ jellyfin: fakeJellyfin() });
    const track = { ref: "ytm:t:abc", title: "Next to Me", artists: [{ name: "Imagine Dragons", mbid: null }], albumTitle: "Evolve", durationMs: 230_000, recording: null };
    expect(await call("jellyfin.matchTracks", { userId: "u1", tracks: [track] })).toMatchObject({ ok: true, value: [{ ref: "ytm:t:abc", item: { jellyfinId: "jf-titre" } }] });
    expect(await call("jellyfin.matchTracks", { userId: "u1", tracks: [] })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(await call("jellyfin.matchTracks", { userId: "u1", tracks: Array.from({ length: 201 }, (_, i) => ({ ...track, ref: `r${i}` })) })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(await call("jellyfin.matchTracks", { userId: "u1", tracks: [{ ...track, recording: "pas-un-mbid" }] })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("playlistEditable : la réponse du cœur pour CE compte ; identifiants hors forme refusés", async () => {
    configureIsolatedRuntime({ jellyfin: fakeJellyfin({ playlistEditable: async ({ userId }) => ({ editable: userId === "u1" }) }) });
    expect(await call("jellyfin.playlistEditable", { userId: "u1", playlistId: "p1" })).toMatchObject({ ok: true, value: { editable: true } });
    expect(await call("jellyfin.playlistEditable", { userId: "u2", playlistId: "p1" })).toMatchObject({ ok: true, value: { editable: false } });
    expect(await call("jellyfin.playlistEditable", { userId: "u1", playlistId: "../x" })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("un refus du service passe avec son code du contrat", async () => {
    configureIsolatedRuntime({ jellyfin: fakeJellyfin({ playlistInsert: async () => { throw new HostMusicFailure("forbidden", "playlist non modifiable"); } }) });
    expect(await call("jellyfin.playlistInsert", { userId: "u1", playlistId: "p1", itemIds: ["a"], position: 0 })).toMatchObject({
      ok: false, error: { code: "forbidden", message: "playlist non modifiable" },
    });
  });
});

describe("events.emit", () => {
  it("en SON nom, à la forme du contrat, par le transport du cœur", async () => {
    const sent: { ids: readonly string[]; event: RuntimeMusicEvent }[] = [];
    configureIsolatedRuntime({ sendMusicEvent: (ids, event) => (sent.push({ ids, event }), ids.length) });
    const out = await call("events.emit", { userIds: ["u1", "u2"], event: { type: "music:pending", pluginId: "vigie" } });
    expect(out).toMatchObject({ ok: true, value: { delivered: 2 } });
    expect(sent).toEqual([{ ids: ["u1", "u2"], event: { type: "music:pending", pluginId: "sillon" } }]);
  });

  it("music:resolved : le titre relayé est celui de la BIBLIOTHÈQUE, compte par compte (pochette comprise) ; pas indexé → celui de l'extension", async () => {
    const sent: { ids: readonly string[]; event: RuntimeMusicEvent }[] = [];
    configureIsolatedRuntime({
      sendMusicEvent: (ids, event) => (sent.push({ ids, event }), ids.length),
      libraryTrack: async (userId, jellyfinId) => (userId === "u1" ? { key: `jf:${jellyfinId}`, artworkUrl: "/api/music/artwork/alb?tag=t" } : null),
    });
    const event = { type: "music:resolved", externalId: "ext:sillon:r", jellyfinId: "jf1", recording: null, track: { key: "jf:jf1", artworkUrl: null } };
    expect(await call("events.emit", { userIds: ["u1", "u2"], event })).toMatchObject({ ok: true, value: { delivered: 2 } });
    expect(sent).toEqual([
      { ids: ["u1"], event: { ...event, pluginId: "sillon", track: { key: "jf:jf1", artworkUrl: "/api/music/artwork/alb?tag=t" } } },
      { ids: ["u2"], event: { ...event, pluginId: "sillon" } },
    ]);
  });

  it("refuse un type du cœur et un événement mal formé", async () => {
    expect(await call("events.emit", { userIds: ["u1"], event: { type: "music:library", added: [] } })).toMatchObject({ error: { code: "forbidden" } });
    expect(await call("events.emit", { userIds: ["u1"], event: { type: "music:resolved", externalId: "x" } })).toMatchObject({ error: { code: "invalid" } });
  });
});
