/**
 * Le verso d'une carte d'Affiner face aux droits du compte : jamais le synopsis
 * d'un titre caché — ni nommé par TMDB, ni accolé à un id de la bibliothèque
 * qu'il voit (docs/DROITS-UTILISATEURS.md § 5).
 */

import { describe, expect, it, vi } from "vitest";

const tmdbFetch = vi.fn(async () => ({ title: "Titre TMDB", overview: "Synopsis", runtime: 100 }));
vi.mock("../tmdb/client", () => ({ tmdbConfigured: () => true, tmdbFetch: (...args: unknown[]) => tmdbFetch(...(args as [])) }));
vi.mock("../configStore", () => ({ getJellyfinUrl: () => null, getJellyfinApiKey: () => null }));
// Le film 666 est caché au compte ; l'id « visible » est un titre qu'il voit ; `hidden` : ce que la
// politique du compte vient de retirer.
const hidden = new Set<number>();
vi.mock("../reco/recoRights", () => ({
  titleAllowedFor: async (_userId: string, title: { tmdbId: number; jellyfinItemId?: string | null }) =>
    title.tmdbId !== 666 && !hidden.has(title.tmdbId) && (title.jellyfinItemId ?? "visible") === "visible",
}));

import { cardDetails } from "./cardDetails";

const EMPTY = { title: null, overview: null, runtimeMinutes: null, seasons: null };

describe("cardDetails et les droits du compte", () => {
  it("titre permis : le verso est servi", async () => {
    expect((await cardDetails("enfant", "movie", 12, "fr", null)).overview).toBe("Synopsis");
  });

  it("titre TMDB caché : verso vide, TMDB jamais interrogé — même accolé à un id visible", async () => {
    tmdbFetch.mockClear();
    expect(await cardDetails("enfant", "movie", 666, "fr", null)).toEqual(EMPTY);
    expect(await cardDetails("enfant", "movie", 666, "fr", "visible")).toEqual(EMPTY);
    expect(tmdbFetch).not.toHaveBeenCalled();
  });

  it("un verso gardé en mémoire ne survit pas à une restriction posée ensuite", async () => {
    expect((await cardDetails("enfant", "movie", 14, "fr", null)).overview).toBe("Synopsis");
    hidden.add(14);
    expect(await cardDetails("enfant", "movie", 14, "fr", null)).toEqual(EMPTY);
    hidden.delete(14);
  });

  it("id de la bibliothèque caché au compte : verso vide", async () => {
    expect(await cardDetails("enfant", "movie", 13, "fr", "cache")).toEqual(EMPTY);
  });
});
