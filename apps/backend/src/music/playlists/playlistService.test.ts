/**
 * Les gestes sur une playlist face à un Jellyfin SIMULÉ fidèle aux relevés du
 * banc (10.11.11, 2026-10-24, confirmés par A5) :
 * - la clé + `userId` AJOUTE au nom du compte, avec ses droits (404 s'il ne la
 *   voit pas, 403 s'il la voit sans pouvoir l'écrire) ;
 * - `Move` refuse la clé (400) ;
 * - `DELETE …/Items?entryIds=` IGNORE `userId` : il retire chez n'importe qui.
 * Le cœur ne doit donc jamais appeler `Move`, jamais retirer sans avoir vérifié
 * le droit, et jamais retirer avant un ajout que Jellyfin aurait refusé.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertIntoPlaylist, moveInPlaylist, removeFromPlaylist } from "./playlistService";
import { resetPlaylistMemoForTests } from "./playlistJellyfin";

interface FakePlaylist {
  owner: string;
  open: boolean;
  items: string[];
}

const { jf } = vi.hoisted(() => ({
  jf: {
    playlists: new Map<string, FakePlaylist>(),
    calls: [] as string[],
    refuseAppend: false,
  },
}));

function visible(p: FakePlaylist | undefined, userId: string): p is FakePlaylist {
  return !!p && (p.owner === userId || p.open);
}

function answer(method: string, path: string, body?: unknown): { ok: boolean; status?: number; data?: unknown } {
  jf.calls.push(`${method} ${path.split("?")[0]}`);
  const url = new URL(`http://jf${path}`);
  const userId = url.searchParams.get("userId") ?? "";
  const item = path.match(/^\/Items\/([^/?]+)/);
  if (method === "GET" && item) {
    const p = jf.playlists.get(item[1]!);
    return visible(p, userId) ? { ok: true, data: { Id: item[1], Type: "Playlist", CanDelete: p.owner === userId } } : { ok: false, status: 404 };
  }
  const move = path.match(/^\/Playlists\/[^/]+\/Items\/[^/]+\/Move\//);
  if (move) return { ok: false, status: 400 };
  const items = path.match(/^\/Playlists\/([^/?]+)\/Items/);
  if (items) {
    const p = jf.playlists.get(items[1]!);
    if (method === "GET") return visible(p, userId) ? { ok: true, data: { Items: p.items.map((Id) => ({ Id, PlaylistItemId: Id })) } } : { ok: false, status: 404 };
    if (method === "DELETE") {
      // Comme Jellyfin : aucun contrôle de propriétaire.
      const gone = new Set((url.searchParams.get("entryIds") ?? "").split(","));
      if (p) p.items = p.items.filter((id) => !gone.has(id));
      return { ok: true };
    }
    if (method === "POST") {
      if (!visible(p, userId)) return { ok: false, status: 404 };
      if (p.owner !== userId || jf.refuseAppend) return { ok: false, status: 403 };
      for (const id of (url.searchParams.get("ids") ?? "").split(",")) if (!p.items.includes(id)) p.items.push(id);
      return { ok: true };
    }
  }
  void body;
  return { ok: false, status: 404 };
}

vi.mock("../jellyfin/musicJellyfin", async (original) => ({
  ...(await original<typeof import("../jellyfin/musicJellyfin")>()),
  jfAdmin: async (path: string, options: { method?: string; body?: unknown } = {}) => {
    const r = answer(options.method ?? "GET", path, options.body);
    return r.ok ? { ok: true, data: r.data } : { ok: false, failure: "invalid", status: r.status };
  },
  jfWrite: async (path: string, method: string, body?: unknown) => {
    const r = answer(method, path, body);
    return r.ok ? { ok: true } : { ok: false, status: r.status };
  },
}));
vi.mock("../events/musicLiveEvents", () => ({ tellPlaylistChanged: () => undefined }));

const OWNER = "a".repeat(32);
const OTHER = "b".repeat(32);
const P = "c".repeat(32);
const SHARED = "d".repeat(32);
const items = (id = P) => jf.playlists.get(id)!.items;
const deletes = () => jf.calls.filter((c) => c.startsWith("DELETE"));

beforeEach(() => {
  resetPlaylistMemoForTests();
  jf.calls.length = 0;
  jf.refuseAppend = false;
  jf.playlists.clear();
  jf.playlists.set(P, { owner: OWNER, open: false, items: ["a", "b", "c", "d"] });
  jf.playlists.set(SHARED, { owner: OWNER, open: true, items: ["a", "b", "c"] });
});

describe("playlist d'un compte non administrateur, face aux pièges de Jellyfin 10.11", () => {
  it("insérer à une position : ajout d'abord, puis la fin réécrite — sans `Move`", async () => {
    expect(await insertIntoPlaylist(OWNER, P, ["x"], 1)).toEqual({ ok: true, value: true });
    expect(items()).toEqual(["a", "x", "b", "c", "d"]);
    const firstPost = jf.calls.indexOf(`POST /Playlists/${P}/Items`);
    expect(firstPost).toBeGreaterThanOrEqual(0);
    expect(firstPost).toBeLessThan(jf.calls.indexOf(`DELETE /Playlists/${P}/Items`));
    expect(jf.calls.some((c) => c.includes("/Move/"))).toBe(false);
  });

  it("déplacer et retirer : par la fin, sans `Move`", async () => {
    expect((await moveInPlaylist(OWNER, P, "d", 0)).ok).toBe(true);
    expect(items()).toEqual(["d", "a", "b", "c"]);
    expect((await removeFromPlaylist(OWNER, P, "b")).ok).toBe(true);
    expect(items()).toEqual(["d", "a", "c"]);
    expect(jf.calls.some((c) => c.includes("/Move/"))).toBe(false);
  });

  it("un autre compte, sur une playlist PRIVÉE : 404, rien retiré (le DELETE ignorerait `userId`)", async () => {
    expect(await insertIntoPlaylist(OTHER, P, ["x"], 0)).toEqual({ ok: false, failure: "not_found" });
    expect(await moveInPlaylist(OTHER, P, "d", 0)).toEqual({ ok: false, failure: "not_found" });
    expect(await removeFromPlaylist(OTHER, P, "a")).toEqual({ ok: false, failure: "not_found" });
    expect(items()).toEqual(["a", "b", "c", "d"]);
    expect(deletes()).toEqual([]);
  });

  it("un autre compte, sur une playlist PUBLIQUE qu'il voit sans pouvoir l'écrire : refusé, rien retiré", async () => {
    expect(await insertIntoPlaylist(OTHER, SHARED, ["x"], 0)).toEqual({ ok: false, failure: "forbidden" });
    expect(await moveInPlaylist(OTHER, SHARED, "c", 0)).toEqual({ ok: false, failure: "forbidden" });
    expect(await removeFromPlaylist(OTHER, SHARED, "a")).toEqual({ ok: false, failure: "forbidden" });
    expect(items(SHARED)).toEqual(["a", "b", "c"]);
    expect(deletes()).toEqual([]);
  });

  it("Jellyfin refuse l'ajout : rien n'a été retiré", async () => {
    jf.refuseAppend = true;
    expect(await insertIntoPlaylist(OWNER, P, ["x"], 0)).toEqual({ ok: false, failure: "forbidden" });
    expect(items()).toEqual(["a", "b", "c", "d"]);
    expect(deletes()).toEqual([]);
  });
});
