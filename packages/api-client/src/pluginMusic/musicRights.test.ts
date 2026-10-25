import { afterEach, describe, expect, it, vi } from "vitest";
import { MUSIC_RIGHTS_BEFORE } from "@tentacle-tv/shared/music";
import { afterOneAcquired, fetchMusicRights } from "./musicRights";
import type { MusicProvider } from "./musicProvider";

const provider = (rights?: string): MusicProvider => ({ pluginId: "ext", name: "Ext", music: { search: "/s", resolve: "/r", ...(rights ? { rights } : {}) } });
const answer = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("droits musique du compte", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("extension d'avant (pas de route) : le comportement d'avant, sans requête", async () => {
    const fetch = answer(200, {});
    vi.stubGlobal("fetch", fetch);
    expect(await fetchMusicRights(provider())).toEqual(MUSIC_RIGHTS_BEFORE);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lit la réponse de l'extension, par son relais", async () => {
    const body = { acquire: false, dailyLimit: 0, remainingToday: null, keepOffline: true, resetsAt: null };
    const fetch = answer(200, body);
    vi.stubGlobal("fetch", fetch);
    expect(await fetchMusicRights(provider("/music/me/rights"))).toEqual(body);
    expect(String((fetch.mock.calls[0] as unknown[])[0])).toContain("/api/plugins/ext/music/me/rights");
  });

  it("réponse en échec ou illisible : comme avant (le serveur refusera s'il le faut)", async () => {
    vi.stubGlobal("fetch", answer(503, { error: "unavailable" }));
    expect(await fetchMusicRights(provider("/music/me/rights"))).toEqual(MUSIC_RIGHTS_BEFORE);
    vi.stubGlobal("fetch", answer(200, { acquire: "oui" }));
    expect(await fetchMusicRights(provider("/music/me/rights"))).toEqual(MUSIC_RIGHTS_BEFORE);
  });

  it("un ajout accepté retire un du reste, jamais sous zéro ; sans limite, rien", () => {
    expect(afterOneAcquired({ ...MUSIC_RIGHTS_BEFORE, dailyLimit: 3, remainingToday: 1 }).remainingToday).toBe(0);
    expect(afterOneAcquired({ ...MUSIC_RIGHTS_BEFORE, dailyLimit: 3, remainingToday: 0 }).remainingToday).toBe(0);
    expect(afterOneAcquired(MUSIC_RIGHTS_BEFORE).remainingToday).toBeNull();
  });
});
