import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le déjumelage de la LG : même contrat que la TV native. Le marqueur avant le
 * premier effacement, tout le compte effacé (clés héritées du web comprises),
 * les réglages de la dalle gardés, la socket de la garde relâchée, et
 * l'ancien jeton mis en file pour le serveur de la page — sauf quand c'est le
 * serveur qui a révoqué.
 */

const h = vi.hoisted(() => ({ events: [] as string[] }));

vi.mock("@tentacle-tv/api-client", () => ({
  notifyUserChange: () => void h.events.push("garde de routes"),
  acquireSocket: () => () => void h.events.push("socket relâchée"),
}));
vi.mock("./revocationQueueTv", () => ({
  scheduleRevocationDrainTv: () => void h.events.push("révocation planifiée"),
}));

import { UNPAIR_PENDING_KEY, readUnpairJournal } from "@tentacle-tv/tv-core";
import { holdSocket } from "./guardSocket";
import { pageStorage } from "./pageStorage";
import { unpairTv } from "./unpairTv";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl";

const store = new Map<string, string>();
const writes: string[] = [];

function context() {
  return {
    client: {
      setAccessToken: (t: string | null) => void h.events.push(`jeton ${t}`),
      setDirectStreaming: () => void h.events.push("direct coupé"),
      adoptJellyfinDeviceId: (id: string | null) => {
        if (id === null) store.delete("tentacle_device_id_jf");
      },
    },
    queryClient: { clear: () => void h.events.push("cache vidé") } as never,
  };
}

beforeEach(() => {
  h.events = [];
  writes.length = 0;
  store.clear();
  for (const [k, v] of Object.entries({
    tentacle_token: JWT,
    tentacle_user: '{"Id":"u1","Name":"Knaoxtest"}',
    tentacle_device_id_jf: "tentacle-x-paired-1",
    tentacle_query_cache_v1: '{"owner":"u1","entries":{}}',
    tentacle_playback_settings: "{}",
    tentacle_language_pending: "en",
    tentacle_reco_providers: "[]",
    tentacle_pending_prefs_u1: "{}",
    tentacle_language: "fr",
    tentacle_webos_rail: '{"masquees":[]}',
    tentacle_device_id: "dalle",
  })) store.set(k, v);
  vi.stubGlobal("localStorage", {
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { writes.push(`set ${k}`); store.set(k, v); },
    removeItem: (k: string) => { writes.push(`remove ${k}`); store.delete(k); },
  });
  vi.stubGlobal("window", { location: { origin: "https://tentacle.example" } });
});
afterEach(() => vi.unstubAllGlobals());

describe("oublier la LG", () => {
  it("pose le marqueur avant le premier effacement", () => {
    unpairTv(context(), "settings");
    expect(writes[0]).toBe(`set ${UNPAIR_PENDING_KEY}`);
  });

  it("efface tout le compte, clés héritées du web comprises, et garde la dalle", () => {
    unpairTv(context(), "settings");
    expect([...store.keys()].sort()).toEqual(
      [UNPAIR_PENDING_KEY, "tentacle_device_id", "tentacle_language", "tentacle_webos_rail"].sort(),
    );
  });

  it("met l'ancien jeton en file pour le serveur de la page", () => {
    unpairTv(context(), "settings");
    expect(readUnpairJournal(pageStorage)).toMatchObject({
      wiping: false,
      revocations: [{ serverUrl: "https://tentacle.example", token: JWT }],
    });
    expect(h.events).toContain("révocation planifiée");
  });

  it("relâche la socket de la garde, coupe le client, puis rend la main à la garde de routes", () => {
    holdSocket(JWT);
    unpairTv(context(), "offline");
    expect(h.events).toEqual(["socket relâchée", "jeton null", "direct coupé", "cache vidé", "garde de routes", "révocation planifiée"]);
  });

  it("révoquée par le serveur : rien à lui renvoyer", () => {
    unpairTv(context(), "revoked");
    expect(store.has(UNPAIR_PENDING_KEY)).toBe(false);
    expect(h.events).not.toContain("révocation planifiée");
  });

  it("une session de navigateur (jeton Jellyfin, pas un JWT) n'est pas révoquée comme un appareil", () => {
    store.set("tentacle_token", "jeton-jellyfin-opaque");
    unpairTv(context(), "settings");
    expect(store.has(UNPAIR_PENDING_KEY)).toBe(false);
    expect(store.has("tentacle_token")).toBe(false);
  });
});
