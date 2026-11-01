/**
 * La copie gardée des pages d'ordre (une playlist, son tri) suit ce qui change ailleurs : un évènement relit une
 * page RANGÉE sans observateur (restaurée du disque), jamais une page jamais vue ; au retour du réseau, celles des
 * collections gardées se relisent.
 */

import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { musicKeys } from "../musicQueryKeys";
import { applyMusicEvent } from "../useMusicLive";
import { refreshKeptOrderPages } from "./orderOutboxApi";

const P1 = "0123456789abcdef0123456789abcdef";

function serve(body: (url: string) => unknown) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify(body(url)), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("pages d'ordre gardées", () => {
  it("music:playlist relit la copie rangée (sans observateur) de cette playlist", async () => {
    const calls = serve(() => ({ name: "P", entries: [{ entryId: "e2", position: 0, track: { key: "jf:b" } }] }));
    const qc = new QueryClient();
    qc.setQueryData(musicKeys.playlist(P1), { name: "P", entries: [] });
    applyMusicEvent(qc, { type: "music:playlist", playlistId: P1 });
    await vi.waitFor(() => expect((qc.getQueryData(musicKeys.playlist(P1)) as { entries: unknown[] }).entries).toHaveLength(1));
    expect(calls.some((u) => u.includes(P1))).toBe(true);
  });

  it("une page jamais vue ne se lit pas sur un évènement", async () => {
    const calls = serve(() => ({}));
    const qc = new QueryClient();
    applyMusicEvent(qc, { type: "music:listPrefs", key: `playlist:${P1}` });
    await new Promise((r) => setTimeout(r, 5));
    expect(calls).toEqual([]);
  });

  it("au retour du réseau : la playlist gardée, son tri, les playlists et les rubriques", async () => {
    const calls = serve((url) => (url.includes("prefs") ? { sort: "custom", direction: "asc", custom: [{ k: "jf:b" }] } : url.includes("shelves") ? { albums: [], artists: [], playlists: [], order: { albums: [], artists: [], playlists: [] } } : url.endsWith("/playlists") ? [] : { entries: [] }));
    const qc = new QueryClient();
    await refreshKeptOrderPages(qc, [`playlist:jf:${P1}`, "album:x"]);
    expect(qc.getQueryData(musicKeys.listPrefs(`playlist:${P1}`))).toEqual({ sort: "custom", direction: "asc", custom: [{ k: "jf:b" }] });
    expect(qc.getQueryData(musicKeys.playlist(P1))).toEqual({ entries: [] });
    expect(calls).toHaveLength(4);
  });
});
