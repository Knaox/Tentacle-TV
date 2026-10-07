import { describe, expect, it } from "vitest";
import type { SetupContext } from "@tentacle-tv/shared";
import { contentFolders, hostPathOf } from "./addContentModel";

const ctx = (inStack: boolean, mediaHostPath: string | null): SetupContext =>
  ({
    mediaFolders: { root: "/media", movies: "/media/films", tvshows: "/media/series" },
    mediaHostPath,
    flow: { databasePending: false, linked: true, noLibraries: false, selection: { url: "http://jellyfin:8096", serverId: "x", serverName: "x", version: "12.1.0", inStack, path: "fresh" } },
  }) as unknown as SetupContext;

describe("où déposer ses fichiers", () => {
  it("le /media du Jellyfin de la pile est, sur le serveur, le dossier monté", () => {
    expect(hostPathOf("/media/films", ctx(true, "/srv/medias/"))).toBe("/srv/medias/films");
    expect(hostPathOf("/media", ctx(true, "/srv/medias"))).toBe("/srv/medias");
    // Hors de /media, un autre Jellyfin, ou le dossier monté inconnu : le chemin de Jellyfin vaut tel quel.
    expect(hostPathOf("/mediatheque/x", ctx(true, "/srv/medias"))).toBeNull();
    expect(hostPathOf("/media/films", ctx(false, "/srv/medias"))).toBeNull();
    expect(hostPathOf("/media/films", { ...ctx(true, "/srv/medias"), flow: { databasePending: false, linked: false, noLibraries: false, selection: null } })).toBe("/srv/medias/films");
    expect(hostPathOf("/media/films", ctx(true, null))).toBeNull();
  });

  it("les bibliothèques créées par l'installation d'abord, sinon celles qui existaient", () => {
    const plans = [{ name: "Films", type: "movies" as const, paths: ["/media/films"] }, { name: "Raté", type: "tvshows" as const, paths: ["/x"] }];
    const existing = [{ name: "Anciens", type: "movies", paths: ["D:\\Films"] }];
    const names = { movies: "Films", tvshows: "Séries" };
    expect(contentFolders({ context: ctx(true, "/srv/medias"), plans, existing, created: new Set(["Films"]), names })).toEqual([
      { name: "Films", type: "movies", path: "/media/films", hostPath: "/srv/medias/films" },
    ]);
    expect(contentFolders({ context: ctx(false, null), plans, existing, created: new Set(), names })).toEqual([
      { name: "Anciens", type: "movies", path: "D:\\Films", hostPath: null },
    ]);
    // Rien de connu (page rechargée) : les dossiers de la pile, pour son Jellyfin seulement.
    expect(contentFolders({ context: ctx(true, "/srv/medias"), plans: [], existing: [], created: new Set(), names }).map((f) => f.hostPath)).toEqual(["/srv/medias/films", "/srv/medias/series"]);
    expect(contentFolders({ context: ctx(false, "/srv/medias"), plans: [], existing: [], created: new Set(), names })).toEqual([]);
  });
});
