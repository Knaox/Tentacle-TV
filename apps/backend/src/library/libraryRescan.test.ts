/**
 * « Réanalyser maintenant » contre un faux Jellyfin : la VRAIE requête part
 * (bon chemin, bons paramètres, clé d'administration dans l'en-tête), un
 * identifiant douteux n'atteint jamais Jellyfin, et chaque refus a son code.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ config: new Map<string, string>() }));

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => env.config.get("jellyfin_url"),
  getJellyfinApiKey: () => env.config.get("jellyfin_api_key"),
}));

import { startLibraryRescan } from "./libraryRescan";

const ITEM = "56d6234ebd87b4a9292be9147a536e1b";
const calls: Array<{ method: string; path: string; auth: string | undefined }> = [];
let status = 204;

const fake = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  calls.push({
    method: init?.method ?? "GET",
    path: url.pathname + url.search,
    auth: (init?.headers as Record<string, string> | undefined)?.Authorization,
  });
  return new Response(null, { status });
});

const log = { info: vi.fn(), warn: vi.fn() };

beforeEach(() => {
  env.config.set("jellyfin_url", "http://jf.test");
  env.config.set("jellyfin_api_key", "cle");
  vi.stubGlobal("fetch", fake);
  calls.length = 0;
  status = 204;
});

afterEach(() => {
  vi.unstubAllGlobals();
  env.config.clear();
  log.info.mockReset();
  log.warn.mockReset();
});

describe("startLibraryRescan", () => {
  it("un titre : Items/{id}/Refresh en profondeur, métadonnées ET images, sans rien remplacer", async () => {
    expect(await startLibraryRescan(ITEM, log)).toEqual({ ok: true, scope: "item" });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.method).toBe("POST");
    const url = new URL(`http://x${call.path}`);
    expect(url.pathname).toBe(`/Items/${ITEM}/Refresh`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      Recursive: "true",
      MetadataRefreshMode: "FullRefresh",
      ImageRefreshMode: "FullRefresh",
      ReplaceAllMetadata: "false",
      ReplaceAllImages: "false",
    });
    // La clé d'administration voyage dans l'en-tête que Jellyfin 10.10 à 12 acceptent.
    expect(call.auth).toBe('MediaBrowser Token="cle"');
    expect(log.info).toHaveBeenCalledWith("[library] analyse lancée : titre 56d6234e");
  });

  it("sans titre : l'analyse de toutes les bibliothèques (Library/Refresh)", async () => {
    expect(await startLibraryRescan(undefined, log)).toEqual({ ok: true, scope: "libraries" });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /Library/Refresh"]);
  });

  it("un identifiant qui n'en est pas un n'atteint jamais Jellyfin", async () => {
    for (const bad of ["../System/Restart", "abc", `${ITEM}?x=1`, ""]) {
      expect(await startLibraryRescan(bad, log)).toEqual({ ok: false, error: "bad-request" });
    }
    expect(calls).toHaveLength(0);
  });

  it("chaque refus a son code : titre disparu, clé refusée, Jellyfin muet, pas configuré", async () => {
    status = 404;
    expect(await startLibraryRescan(ITEM, log)).toEqual({ ok: false, error: "not-found" });
    status = 401;
    expect(await startLibraryRescan(ITEM, log)).toEqual({ ok: false, error: "rejected" });
    status = 500;
    expect(await startLibraryRescan(ITEM, log)).toEqual({ ok: false, error: "failed" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    expect(await startLibraryRescan(ITEM, log)).toEqual({ ok: false, error: "unreachable" });
    env.config.delete("jellyfin_api_key");
    expect(await startLibraryRescan(ITEM, log)).toEqual({ ok: false, error: "not-configured" });
    // Le journal ne porte ni clé ni adresse : le préfixe de l'identifiant et le code.
    for (const [line] of log.warn.mock.calls) expect(String(line)).not.toMatch(/cle|jf\.test/);
  });

  it("un appel à la fois : le second, pendant le premier, est « occupé »", async () => {
    let release: () => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
      release = () => resolve(new Response(null, { status: 204 }));
    })));
    const first = startLibraryRescan(undefined, log);
    expect(await startLibraryRescan(ITEM, log)).toEqual({ ok: false, error: "busy" });
    release();
    expect(await first).toEqual({ ok: true, scope: "libraries" });
  });
});
