import Fastify from "fastify";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La page de partage autonome (interface web coupée) : la liste du propriétaire
 * écrite par le serveur, sans script ni rien du client web ; « indisponible »
 * sans son droit « Partage public » ; jamais un jeton, ni l'adresse de
 * Jellyfin, ni un texte injecté.
 */

interface Link { token: string; kind: string; ownerUserId: string; ownerUsername: string }
const links: Link[] = [];
const state = { allowed: true, fail: false };
const OWNER = "9827c469645e471896d0c27cd8c72141";
const ITEM = "f137a2dd21bbc1b99aa5c0f6bf02a805";

vi.mock("../services/db", () => ({
  getPrisma: () => ({ shareLink: { findUnique: async ({ where }: { where: { token: string } }) => links.find((l) => l.token === where.token) ?? null } }),
}));
vi.mock("../services/share/publicSharingRight", () => ({ mayShareInPublic: async () => state.allowed }));
vi.mock("../services/shareLists", () => ({
  sharedListEntries: async () => {
    if (state.fail) throw new Error("Jellyfin muet");
    return [
      { Id: ITEM, Name: "Alien <le 8e passager>", Type: "Movie", ProductionYear: 1979, ImageTags: { Primary: "abc123" }, InLibrary: true },
      { Id: "", Name: "Dark", Type: "Series", PosterUrl: "https://image.tmdb.org/t/p/w342/dark.jpg", InLibrary: false },
      { Id: "", Name: "Piège", Type: "Movie", PosterUrl: "https://ailleurs.example/p.jpg", InLibrary: false },
    ];
  },
}));

import { loadSharePage, sharePageCsp, sharePageToken } from "./sharePage";
import { sharePageHtml } from "./sharePageHtml";
import { registerStaticClients } from "./staticClients";

const WEB = mkdtempSync(join(tmpdir(), "tentacle-share-"));
mkdirSync(join(WEB, "assets"));
writeFileSync(join(WEB, "index.html"), "<!DOCTYPE html><title>web</title>");
afterAll(() => rmSync(WEB, { recursive: true, force: true }));

beforeEach(() => {
  links.length = 0;
  links.push({ token: "3f2a9c01be44d7e6", kind: "likes", ownerUserId: OWNER, ownerUsername: "Knaoxtest" });
  links.push({ token: "aaaabbbbccccdddd", kind: "stats", ownerUserId: OWNER, ownerUsername: "Knaoxtest" });
  state.allowed = true;
  state.fail = false;
});

describe("le chemin", () => {
  it("lit le jeton de /share/<jeton> et de la fiche du web ; refuse le reste", () => {
    expect(sharePageToken("/share/3F2A9C01BE44D7E6")).toBe("3f2a9c01be44d7e6");
    expect(sharePageToken(`/share/3f2a9c01be44d7e6/${ITEM}`)).toBe("3f2a9c01be44d7e6");
    for (const path of ["/share/", "/share", "/sharex/abc", "/share/a/b/c", "/share/<script>", "/share/abc/<x>"]) expect(sharePageToken(path)).toBeNull();
  });
});

describe("ce que la page montre", () => {
  it("la liste du propriétaire ; affiches du serveur sans jeton, de TMDB à l'adresse exacte, sinon aucune", async () => {
    const view = await loadSharePage("3f2a9c01be44d7e6");
    expect(view).toMatchObject({ state: "list", kind: "likes", owner: "Knaoxtest" });
    if (view.state !== "list") throw new Error("liste attendue");
    expect(view.items.map((item) => item.poster)).toEqual([
      `/api/jellyfin/Items/${ITEM}/Images/Primary?fillHeight=450&quality=90&tag=abc123`,
      "https://image.tmdb.org/t/p/w342/dark.jpg",
      null,
    ]);
  });

  it("introuvable, indisponible sans le droit, statistiques, panne", async () => {
    expect((await loadSharePage("inconnu")).state).toBe("not_found");
    expect((await loadSharePage("aaaabbbbccccdddd")).state).toBe("stats");
    state.allowed = false;
    expect((await loadSharePage("3f2a9c01be44d7e6")).state).toBe("unavailable");
    state.allowed = true;
    state.fail = true;
    expect((await loadSharePage("3f2a9c01be44d7e6")).state).toBe("error");
  });

  it("échappe tout texte ; aucun script, et la politique n'en admet aucun", async () => {
    const view = await loadSharePage("3f2a9c01be44d7e6");
    const html = sharePageHtml({ lang: "fr", view, path: "/share/3f2a9c01be44d7e6", nonce: "bm9uY2U=" });
    expect(html).toContain("Alien &lt;le 8e passager&gt;");
    expect(html).toContain("Les favoris de Knaoxtest");
    expect(html).not.toContain("<script");
    expect(sharePageCsp("bm9uY2U=")).not.toContain("script-src");
    expect(sharePageCsp("bm9uY2U=")).toContain("default-src 'none'");
  });
});

describe("le câblage, interface web coupée", () => {
  const server = async (enabled: boolean) => {
    const app = Fastify();
    await registerStaticClients(app, { webPath: WEB, tvBuildPath: WEB, webUi: () => ({ enabled, setupComplete: true }) });
    await app.ready();
    return app;
  };

  it("un lien de partage mène à la page autonome, dans la langue du navigateur, jamais en cache", async () => {
    const res = await (await server(false)).inject({ method: "GET", url: "/share/3f2a9c01be44d7e6", headers: { "accept-language": "en-US" } });
    expect([res.statusCode, res.headers["content-type"], res.headers["cache-control"]]).toEqual([200, "text/html; charset=utf-8", "no-store"]);
    expect(res.body).toContain("Knaoxtest&#39;s favorites");
    expect(res.body).not.toContain("<title>web</title>");
  });

  it("droit retiré : 403 « indisponible », puis la liste revient avec lui", async () => {
    const app = await server(false);
    state.allowed = false;
    const off = await app.inject({ method: "GET", url: "/share/3f2a9c01be44d7e6?lang=fr" });
    expect([off.statusCode, off.body.includes("Lien indisponible"), off.body.includes("Alien")]).toEqual([403, true, false]);
    state.allowed = true;
    expect((await app.inject({ method: "GET", url: "/share/3f2a9c01be44d7e6" })).statusCode).toBe(200);
  });

  it("allumée : `/share/…` reste la page du client web", async () => {
    const res = await (await server(true)).inject({ method: "GET", url: "/share/3f2a9c01be44d7e6" });
    expect(res.body).toBe("<!DOCTYPE html><title>web</title>");
  });
});
