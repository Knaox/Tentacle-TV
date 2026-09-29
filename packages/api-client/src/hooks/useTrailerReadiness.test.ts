/**
 * La lecture du diagnostic des bandes-annonces : une réponse valide passe
 * telle quelle, un serveur d'avant la route (404) ou une réponse illisible
 * valent « pas de diagnostic » (`null`), une vraie panne remonte. Et
 * l'adresse du tableau de bord de Jellyfin pour les liens du guide : sans
 * barre finale, et rien quand le serveur ne la donne pas.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTrailerReadiness } from "./useTrailerReadiness";
import { fetchJellyfinDashboardUrl } from "./useJellyfinDashboardUrl";

afterEach(() => {
  vi.unstubAllGlobals();
});

const respond = (body: unknown, status = 200) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })));

describe("fetchTrailerReadiness", () => {
  it("rend le diagnostic du serveur", async () => {
    const readiness = { state: "misconfigured", reasons: ["tmdb-fetcher-disabled"], coverage: 0, checkedAt: "2026-09-29T12:00:00.000Z" };
    respond(readiness);
    await expect(fetchTrailerReadiness()).resolves.toEqual(readiness);
  });

  it("complète une réponse partielle sans l'inventer", async () => {
    respond({ state: "ready" });
    await expect(fetchTrailerReadiness()).resolves.toEqual({ state: "ready", reasons: [], coverage: null, checkedAt: "" });
  });

  it("un serveur d'avant la route, ou une réponse illisible : pas de diagnostic", async () => {
    respond("Not Found", 404);
    await expect(fetchTrailerReadiness()).resolves.toBeNull();
    respond({ state: "peut-être" });
    await expect(fetchTrailerReadiness()).resolves.toBeNull();
  });

  it("une vraie panne remonte", async () => {
    respond("boom", 502);
    await expect(fetchTrailerReadiness()).rejects.toMatchObject({ status: 502 });
  });
});

describe("fetchJellyfinDashboardUrl", () => {
  it("rend l'adresse du tableau de bord, sans barre finale", async () => {
    respond({ dashboardUrl: "https://jf.example.org/", checks: [] });
    await expect(fetchJellyfinDashboardUrl()).resolves.toBe("https://jf.example.org");
  });

  it("rien à dire : adresse absente, compte refusé, serveur trop ancien", async () => {
    respond({ dashboardUrl: null });
    await expect(fetchJellyfinDashboardUrl()).resolves.toBeNull();
    respond({ error: "forbidden" }, 403);
    await expect(fetchJellyfinDashboardUrl()).resolves.toBeNull();
    respond("Not Found", 404);
    await expect(fetchJellyfinDashboardUrl()).resolves.toBeNull();
  });
});
