/**
 * `jellyfin.refreshPath` face à un Jellyfin SIMULÉ (bibliothèque → artistes →
 * albums, enfants directs par `ParentId`, chemins tels que Jellyfin les voit) :
 * le dossier connu le plus proche se rafraîchit récursivement ; un artiste
 * neuf passe par la bibliothèque sans récursion ; hors bibliothèque, `invalid`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { HOST_PARAM_SCHEMAS } from "../../plugins/runtime/hostSchemas";
import { insidePath, isLibraryPath } from "./folderRefresh";
import { refreshPath } from "./jellyfinMusicHost";

const { jf } = vi.hoisted(() => ({
  jf: {
    /** id → { parent, path } */
    folders: new Map<string, { parent: string; path: string }>(),
    refreshes: [] as string[],
    /** Un dossier qui n'apparaît qu'après le rafraîchissement NON récursif de la bibliothèque. */
    pendingArtist: null as null | { id: string; path: string },
    mute: false,
  },
}));

const LIB = { libraryId: "lib", name: "Musique", paths: ["/music"] };

vi.mock("../jellyfin/musicLibrary", () => ({ getMusicLibrary: async () => LIB }));
vi.mock("../../services/jellyfinLibrary", () => ({ adminUserParam: async () => "&userId=admin" }));
vi.mock("../jellyfin/musicJellyfin", async (original) => ({
  ...(await original<typeof import("../jellyfin/musicJellyfin")>()),
  jfAdmin: async (path: string) => {
    if (jf.mute) return { ok: false, failure: "unreachable" };
    const parent = new URL(`http://jf${path}`).searchParams.get("ParentId");
    const Items = [...jf.folders].filter(([, f]) => f.parent === parent).map(([Id, f]) => ({ Id, Path: f.path, IsFolder: true }));
    return { ok: true, data: { Items } };
  },
  jfWrite: async (path: string) => {
    if (jf.mute) return { ok: false };
    const url = new URL(`http://jf${path}`);
    const id = url.pathname.split("/")[2]!;
    jf.refreshes.push(`${id}:${url.searchParams.get("Recursive")}`);
    if (id === "lib" && url.searchParams.get("Recursive") === "false" && jf.pendingArtist) {
      jf.folders.set(jf.pendingArtist.id, { parent: "lib", path: jf.pendingArtist.path });
    }
    return { ok: true };
  },
}));

beforeEach(() => {
  jf.folders.clear();
  jf.refreshes.length = 0;
  jf.pendingArtist = null;
  jf.mute = false;
  jf.folders.set("km", { parent: "lib", path: "/music/Kevin MacLeod" });
  jf.folders.set("bpw", { parent: "km", path: "/music/Kevin MacLeod/Bright Piano Works (2007)" });
  jf.folders.set("ep", { parent: "km", path: "/music/Kevin MacLeod/Elegant Piano (2006)" });
});

describe("jellyfin.refreshPath", () => {
  it("un fichier ou un dossier d'ALBUM connu : cet album, récursivement", async () => {
    expect(await refreshPath({ path: "/music/Kevin MacLeod/Bright Piano Works (2007)/05 - Nouveau.flac" })).toEqual({ ok: true, scope: "folder", itemId: "bpw" });
    expect(await refreshPath({ path: "/music/Kevin MacLeod/Elegant Piano (2006)/" })).toEqual({ ok: true, scope: "folder", itemId: "ep" });
    expect(jf.refreshes).toEqual(["bpw:true", "ep:true"]);
  });

  it("un album NEUF d'un artiste connu : l'artiste, récursivement", async () => {
    expect(await refreshPath({ path: "/music/Kevin MacLeod/Album neuf (2026)" })).toEqual({ ok: true, scope: "folder", itemId: "km" });
    expect(jf.refreshes).toEqual(["km:true"]);
  });

  it("un artiste NEUF : la bibliothèque sans récursion, puis le dossier apparu, récursivement", async () => {
    jf.pendingArtist = { id: "neuf", path: "/music/Artiste neuf" };
    expect(await refreshPath({ path: "/music/Artiste neuf/Premier album (2026)" })).toEqual({ ok: true, scope: "library", itemId: "neuf" });
    expect(jf.refreshes).toEqual(["lib:false", "neuf:true"]);
  });

  it("hors de la bibliothèque musique, ou chemin trompeur : invalid, rien rafraîchi", async () => {
    for (const path of ["/films/Un film", "/musique/x", "/music/../etc", "music/Kevin MacLeod", ""]) {
      await expect(refreshPath({ path })).rejects.toMatchObject({ code: "invalid" });
    }
    expect(jf.refreshes).toEqual([]);
  });

  it("Jellyfin muet : unavailable", async () => {
    jf.mute = true;
    await expect(refreshPath({ path: "/music/Kevin MacLeod" })).rejects.toMatchObject({ code: "unavailable" });
  });

  it("règles pures des chemins, et le schéma de l'API d'hôte", () => {
    expect(insidePath("/music/a/b", "/music/a/")).toBe(true);
    expect(insidePath("/music/ab", "/music/a")).toBe(false);
    expect(isLibraryPath({ ...LIB, paths: ["D:\\Musique"] }, "D:\\Musique\\Artiste")).toBe(true);
    const schema = HOST_PARAM_SCHEMAS["jellyfin.refreshPath"];
    expect(schema.safeParse({ path: "/music/Kevin MacLeod" }).success).toBe(true);
    expect(schema.safeParse({ path: "relatif/x" }).success).toBe(false);
    expect(schema.safeParse({ path: "/music/../x" }).success).toBe(false);
    expect(schema.safeParse({ path: `/${"x".repeat(1100)}` }).success).toBe(false);
    expect(schema.safeParse({ path: "/music", extra: 1 }).success).toBe(false);
  });
});
