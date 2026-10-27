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
import { deletePlaylist, insertIntoPlaylist, moveInPlaylist, removeFromPlaylist, reorderPlaylist, rewritePlaylist, updatePlaylistDetails } from "./playlistService";
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
    longest: 0,
    saved: new Map<string, Record<string, unknown>>(),
  },
}));

function visible(p: FakePlaylist | undefined, userId: string): p is FakePlaylist {
  return !!p && (p.owner === userId || p.open);
}

function answer(method: string, path: string, body?: unknown): { ok: boolean; status?: number; data?: unknown } {
  jf.calls.push(`${method} ${path.split("?")[0]}`);
  jf.longest = Math.max(jf.longest, path.length);
  const url = new URL(`http://jf${path}`);
  const userId = url.searchParams.get("userId") ?? "";
  const item = path.match(/^\/Items\/([^/?]+)/);
  if (method === "GET" && item) {
    const p = jf.playlists.get(item[1]!);
    return visible(p, userId) ? { ok: true, data: { Id: item[1], Type: "Playlist", CanDelete: p.owner === userId, Name: "Avant", Overview: "", ...jf.saved.get(item[1]!) } } : { ok: false, status: 404 };
  }
  // La fiche réécrite par la clé (relevé du lot : `POST /Items/{id}` l'accepte), et la suppression.
  if (method === "POST" && item) {
    jf.saved.set(item[1]!, body as Record<string, unknown>);
    return { ok: true };
  }
  if (method === "DELETE" && item) {
    jf.playlists.delete(item[1]!);
    return { ok: true };
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
  jf.saved.clear();
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

  it("réécrire d'après la playlist telle qu'elle est (la réparation) : le plan lit les entrées, `null` n'écrit rien", async () => {
    const seen: string[][] = [];
    expect(await rewritePlaylist(OWNER, P, async (current) => (seen.push(current.map((e) => e.itemId)), ["d", "c", "b", "a"]))).toEqual({ ok: true, value: true });
    expect(items()).toEqual(["d", "c", "b", "a"]);
    jf.calls.length = 0;
    expect((await rewritePlaylist(OWNER, P, async () => null)).ok).toBe(true);
    expect(deletes()).toEqual([]);
    expect(seen).toEqual([["a", "b", "c", "d"]]);
    expect((await rewritePlaylist(OTHER, P, async () => ["a"])).ok).toBe(false);
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

describe("réordonner toute la playlist (glisser dans Octave)", () => {
  it("l'ordre complet du client devient celui de Jellyfin — sans `Move`", async () => {
    expect(await reorderPlaylist(OWNER, P, ["c", "a", "d", "b"])).toEqual({ ok: true, value: true });
    expect(items()).toEqual(["c", "a", "d", "b"]);
    expect(jf.calls.some((c) => c.includes("/Move/"))).toBe(false);
  });

  it("une entrée ajoutée entre-temps reste après son prédécesseur ; une entrée disparue est ignorée", async () => {
    jf.playlists.get(P)!.items = ["a", "b", "n", "c", "d"];
    expect((await reorderPlaylist(OWNER, P, ["d", "c", "b", "a", "gone"])).ok).toBe(true);
    expect(items()).toEqual(["d", "c", "b", "n", "a"]);
  });

  it("1 000 titres : des requêtes sous la borne de Jellyfin (8 Kio), rien de perdu", async () => {
    const ids = Array.from({ length: 1000 }, (_, i) => i.toString(16).padStart(32, "0"));
    jf.playlists.get(P)!.items = [...ids];
    const wanted = [ids[999]!, ...ids.slice(0, 999)];
    jf.longest = 0;
    expect((await reorderPlaylist(OWNER, P, wanted)).ok).toBe(true);
    expect(items()).toEqual(wanted);
    expect(jf.longest).toBeLessThan(8 * 1024);
  });

  it("un autre compte : refusé, rien retiré", async () => {
    expect(await reorderPlaylist(OTHER, SHARED, ["c", "b", "a"])).toEqual({ ok: false, failure: "forbidden" });
    expect(items(SHARED)).toEqual(["a", "b", "c"]);
    expect(deletes()).toEqual([]);
  });
});

vi.mock("../listOrder/listPrefsStore", () => ({ forgetPlaylistOrder: async () => undefined }));

describe("gérer une playlist : nom, description, suppression", () => {
  it("le nom et la description réécrivent la fiche entière, sans toucher au reste", async () => {
    expect(await updatePlaylistDetails(OWNER, P, { description: "Pour la route" })).toEqual({ ok: true, value: true });
    expect(jf.saved.get(P)).toMatchObject({ Name: "Avant", Overview: "Pour la route", Type: "Playlist" });
    expect(await updatePlaylistDetails(OWNER, P, { name: "Été", description: "" })).toEqual({ ok: true, value: true });
    expect(jf.saved.get(P)).toMatchObject({ Name: "Été", Overview: "" });
  });

  it("un autre compte ne renomme ni ne supprime : refusé AVANT toute écriture", async () => {
    expect(await updatePlaylistDetails(OTHER, SHARED, { name: "Pirate" })).toEqual({ ok: false, failure: "forbidden" });
    expect(await deletePlaylist(OTHER, SHARED)).toEqual({ ok: false, failure: "forbidden" });
    expect(await deletePlaylist(OTHER, P)).toEqual({ ok: false, failure: "not_found" });
    expect(jf.saved.size).toBe(0);
    expect(jf.playlists.has(SHARED)).toBe(true);
    expect(deletes()).toEqual([]);
  });

  it("le propriétaire supprime", async () => {
    expect(await deletePlaylist(OWNER, P)).toEqual({ ok: true, value: true });
    expect(jf.playlists.has(P)).toBe(false);
  });
});

describe("règle de Damien : jamais un titre supprimé du serveur", () => {
  const audioDeletes = () => jf.calls.filter((c) => c.startsWith("DELETE /Items/") && c !== `DELETE /Items/${P}`);

  it("retirer un titre d'une playlist : l'ENTRÉE sort (DELETE …/Items?entryIds), jamais l'élément audio", async () => {
    expect((await removeFromPlaylist(OWNER, P, "b")).ok).toBe(true);
    expect(jf.calls.filter((c) => c.startsWith("DELETE"))).toEqual([`DELETE /Playlists/${P}/Items`]);
    expect(audioDeletes()).toEqual([]);
  });

  it("supprimer une playlist : l'OBJET playlist seul (DELETE /Items/<playlist>), aucun titre, aucun appel hors Jellyfin", async () => {
    expect((await deletePlaylist(OWNER, P)).ok).toBe(true);
    expect(jf.calls.filter((c) => c.startsWith("DELETE"))).toEqual([`DELETE /Items/${P}`]);
    expect(audioDeletes()).toEqual([]);
    // Le cœur ne parle qu'à Jellyfin : aucune route de Lidarr, aucune suppression de fichier.
    expect(jf.calls.some((c) => /lidarr|\/Library\/|\/Videos\/|\/Audio\//i.test(c))).toBe(false);
  });

  it("réordonner ou retirer en masse ne touche jamais un élément audio", async () => {
    expect((await reorderPlaylist(OWNER, P, ["d", "c", "b", "a"])).ok).toBe(true);
    expect(audioDeletes()).toEqual([]);
  });
});

