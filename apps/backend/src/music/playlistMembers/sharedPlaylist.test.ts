/**
 * Une playlist PARTAGÉE entre comptes, face au Jellyfin simulé des relevés (10.11) : la playlist reste privée chez
 * Jellyfin (un membre n'y voit rien, n'y écrit rien), Tentacle tient le droit et agit au nom du propriétaire.
 * Le droit se vérifie AVANT tout geste ; une playlist partagée n'est jamais réordonnée dans Jellyfin.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertIntoPlaylist, moveInPlaylist, removeFromPlaylist, reorderPlaylist, updatePlaylistDetails, deletePlaylist } from "../playlists/playlistService";
import { resetPlaylistMemoForTests } from "../playlists/playlistJellyfin";
import { accessAllows, playlistAccess } from "./playlistAccess";
import type { MemberRow } from "./memberStore";

const { jf, members, told } = vi.hoisted(() => ({
  jf: { playlists: new Map<string, { owner: string; items: string[] }>(), calls: [] as string[] },
  members: [] as MemberRow[],
  told: [] as string[],
}));

function answer(method: string, path: string): { ok: boolean; status?: number; data?: unknown } {
  jf.calls.push(`${method} ${path.split("?")[0]}`);
  const url = new URL(`http://jf${path}`);
  const userId = url.searchParams.get("userId") ?? "";
  const item = path.match(/^\/Items\/([^/?]+)/);
  if (method === "GET" && item) {
    const p = jf.playlists.get(item[1]!);
    return p && p.owner === userId ? { ok: true, data: { Id: item[1], Type: "Playlist", CanDelete: true, Name: "Été" } } : { ok: false, status: 404 };
  }
  if (method === "DELETE" && item) return jf.playlists.delete(item[1]!) ? { ok: true } : { ok: false, status: 404 };
  const items = path.match(/^\/Playlists\/([^/?]+)\/Items/);
  if (items) {
    const p = jf.playlists.get(items[1]!);
    if (method === "GET") return p && p.owner === userId ? { ok: true, data: { Items: p.items.map((Id) => ({ Id, PlaylistItemId: Id })) } } : { ok: false, status: 404 };
    if (method === "DELETE") {
      const gone = new Set((url.searchParams.get("entryIds") ?? "").split(","));
      if (p) p.items = p.items.filter((id) => !gone.has(id));
      return { ok: true };
    }
    if (method === "POST") {
      // Jellyfin juge au nom de `userId` : seul le propriétaire écrit (la playlist est privée chez lui).
      if (!p || p.owner !== userId) return { ok: false, status: 404 };
      for (const id of (url.searchParams.get("ids") ?? "").split(",")) if (!p.items.includes(id)) p.items.push(id);
      return { ok: true };
    }
  }
  return { ok: false, status: 404 };
}

vi.mock("../jellyfin/musicJellyfin", async (original) => ({
  ...(await original<typeof import("../jellyfin/musicJellyfin")>()),
  jfAdmin: async (path: string, options: { method?: string } = {}) => {
    const r = answer(options.method ?? "GET", path);
    return r.ok ? { ok: true, data: r.data } : { ok: false, failure: "invalid", status: r.status };
  },
  jfWrite: async (path: string, method: string) => {
    const r = answer(method, path);
    return r.ok ? { ok: true } : { ok: false, status: r.status };
  },
}));
vi.mock("../../serverCapabilities/declaredCapabilities", () => ({ isCapabilityDeclared: () => true }));
vi.mock("../events/musicLiveEvents", () => ({ tellPlaylistChanged: (userId: string) => void told.push(userId) }));
vi.mock("../listOrder/listPrefsStore", () => ({ forgetPlaylistOrder: async () => undefined }));
vi.mock("../playlistSource/sourceStore", () => ({ forgetPlaylistSource: async () => undefined }));
vi.mock("../playlistShare/shareStore", () => ({ forgetPlaylistShares: async () => undefined }));
vi.mock("./memberStore", async (original) => {
  const real = await original<typeof import("./memberStore")>();
  return {
    idOf: real.idOf,
    membersOf: async (playlistId: string) => members.filter((m) => m.playlistId === playlistId),
    membershipOf: async (playlistId: string, memberId: string) => members.find((m) => m.playlistId === playlistId && m.memberId === memberId) ?? null,
    forgetPlaylistMembers: async (playlistId: string) => {
      const gone = members.filter((m) => m.playlistId === playlistId).map((m) => m.memberId);
      members.splice(0, members.length, ...members.filter((m) => m.playlistId !== playlistId));
      return gone;
    },
  };
});

const OWNER = "a".repeat(32);
const READER = "b".repeat(32);
const ADDER = "c".repeat(32);
const REMOVER = "d".repeat(32);
const STRANGER = "e".repeat(32);
const P = "f".repeat(32);
const items = () => jf.playlists.get(P)!.items;
const member = (memberId: string, right: MemberRow["right"]): MemberRow => ({ playlistId: P, memberId, ownerUserId: OWNER, right, createdAt: 0 });

beforeEach(() => {
  resetPlaylistMemoForTests();
  jf.calls.length = 0;
  told.length = 0;
  jf.playlists.clear();
  jf.playlists.set(P, { owner: OWNER, items: ["a", "b", "c"] });
  members.splice(0, members.length, member(READER, "read"), member(ADDER, "add"), member(REMOVER, "remove"));
});

describe("l'accès d'un compte à une playlist partagée", () => {
  it("le propriétaire, chaque membre avec son droit, un inconnu ne la voit pas", async () => {
    expect((await playlistAccess(OWNER, P))?.right).toBe("owner");
    const reader = await playlistAccess(READER, P);
    expect(reader?.right).toBe("read");
    // Lue au nom du propriétaire : Jellyfin ne la montre qu'à lui.
    expect(reader?.readerId).toBe(OWNER);
    expect(await playlistAccess(STRANGER, P)).toBeNull();
  });

  it("un membre dont le propriétaire n'a plus la playlist n'a plus rien", async () => {
    jf.playlists.set(P, { owner: STRANGER, items: [] });
    expect(await playlistAccess(READER, P)).toBeNull();
  });

  it("gérer (renommer, partager, supprimer) : le propriétaire seulement", () => {
    expect(accessAllows("owner", "manage")).toBe(true);
    expect(accessAllows("remove", "manage")).toBe(false);
    expect(accessAllows(null, "add")).toBe(false);
    expect(accessAllows(null, "read")).toBe(true);
  });
});

describe("les gestes d'un membre, tenus par le serveur", () => {
  it("lire seulement : ni ajout ni retrait, et rien n'est écrit chez Jellyfin", async () => {
    expect(await insertIntoPlaylist(READER, P, ["x"])).toEqual({ ok: false, failure: "forbidden" });
    expect(await removeFromPlaylist(READER, P, "a")).toEqual({ ok: false, failure: "forbidden" });
    expect(jf.calls.filter((c) => !c.startsWith("GET"))).toEqual([]);
    expect(items()).toEqual(["a", "b", "c"]);
  });

  it("ajouter : au nom du propriétaire, toujours à la FIN (même une position demandée), rien ne bouge", async () => {
    expect((await insertIntoPlaylist(ADDER, P, ["x"], 0)).ok).toBe(true);
    expect(items()).toEqual(["a", "b", "c", "x"]);
    // Jamais de réécriture de la fin : un ajout dans une playlist partagée ne retire rien.
    expect(jf.calls.some((c) => c.startsWith("DELETE"))).toBe(false);
    expect(await removeFromPlaylist(ADDER, P, "a")).toEqual({ ok: false, failure: "forbidden" });
  });

  it("le propriétaire aussi ajoute au bout d'une playlist partagée (l'ordre est à chacun)", async () => {
    expect((await insertIntoPlaylist(OWNER, P, ["b"], 0)).ok).toBe(true);
    expect(items()).toEqual(["a", "b", "c"]);
  });

  it("retirer : le droit le plus fort retire, au nom du propriétaire", async () => {
    expect((await removeFromPlaylist(REMOVER, P, "b")).ok).toBe(true);
    expect(items()).toEqual(["a", "c"]);
    expect((await insertIntoPlaylist(REMOVER, P, ["y"])).ok).toBe(true);
  });

  it("un membre ne renomme, ne réordonne, ne supprime rien", async () => {
    expect(await updatePlaylistDetails(REMOVER, P, { name: "Hiver" })).toEqual({ ok: false, failure: "forbidden" });
    expect(await reorderPlaylist(REMOVER, P, ["c", "b", "a"])).toEqual({ ok: false, failure: "forbidden" });
    expect(await deletePlaylist(REMOVER, P)).toEqual({ ok: false, failure: "forbidden" });
    expect(jf.playlists.has(P)).toBe(true);
  });

  it("réordonner une playlist partagée ne touche jamais Jellyfin, même pour le propriétaire", async () => {
    expect(await reorderPlaylist(OWNER, P, ["c", "b", "a"])).toEqual({ ok: true, value: true });
    expect(await moveInPlaylist(OWNER, P, "c", 0)).toEqual({ ok: true, value: true });
    expect(items()).toEqual(["a", "b", "c"]);
  });

  it("un geste se dit au propriétaire et à chaque membre", async () => {
    await insertIntoPlaylist(ADDER, P, ["x"]);
    await new Promise((r) => setTimeout(r, 0));
    expect(new Set(told)).toEqual(new Set([OWNER, READER, ADDER, REMOVER]));
  });

  it("supprimée par le propriétaire : ses membres partent avec elle et l'apprennent", async () => {
    expect((await deletePlaylist(OWNER, P)).ok).toBe(true);
    expect(members).toEqual([]);
    expect(new Set(told)).toEqual(new Set([OWNER, READER, ADDER, REMOVER]));
  });

  it("sans membre, la playlist garde le comportement d'avant (insertion à sa place)", async () => {
    members.length = 0;
    expect((await insertIntoPlaylist(OWNER, P, ["x"], 1)).ok).toBe(true);
    expect(items()).toEqual(["a", "x", "b", "c"]);
  });
});
