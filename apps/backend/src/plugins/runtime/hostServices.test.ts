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
  setFavorite: async () => ({ ok: true }),
  playlistInsert: async () => ({ ok: true }),
  playlistEntries: async () => [],
  usageOf: async () => [],
  notifyPath: async () => ({ ok: true }),
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

  it("refuse un type du cœur et un événement mal formé", async () => {
    expect(await call("events.emit", { userIds: ["u1"], event: { type: "music:library", added: [] } })).toMatchObject({ error: { code: "forbidden" } });
    expect(await call("events.emit", { userIds: ["u1"], event: { type: "music:resolved", externalId: "x" } })).toMatchObject({ error: { code: "invalid" } });
  });
});
