/**
 * Le titre d'un aperçu, lu AU NOM du compte : un titre qu'il ne voit pas
 * n'existe pas pour lui ; un épisode, une saison valent leur série ; ce qui
 * n'est ni un film ni une série n'a pas de bande-annonce. Jellyfin est factice.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JellyfinResult } from "../../jellyfinAdminFetch";

const { jellyfinAdminFetch } = vi.hoisted(() => ({ jellyfinAdminFetch: vi.fn<(path: string) => Promise<JellyfinResult<unknown>>>() }));
vi.mock("../../jellyfinAdminFetch", () => ({ jellyfinAdminFetch }));

import { resetPreviewTitles, resolvePreviewTitle } from "./previewTitle";

const MOVIE = "0123456789abcdef0123456789abcdef";
const SERIES = "fedcba9876543210fedcba9876543210";
const EPISODE = "11111111111111111111111111111111";
const SEASON = "22222222222222222222222222222222";
const BOXSET = "33333333333333333333333333333333";
const HIDDEN = "44444444444444444444444444444444";
const ALICE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BOB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

/** La bibliothèque factice : ce que voit chaque compte. */
const LIBRARY: Record<string, unknown> = {
  [MOVIE]: { Id: MOVIE, Type: "Movie", ProviderIds: { Tmdb: "438631" }, RemoteTrailers: [{ Url: "https://youtu.be/abcdefghijk", Name: "Trailer" }, { Name: "sans URL" }] },
  [SERIES]: { Id: SERIES, Type: "Series", ProviderIds: { Tmdb: "1396" }, RemoteTrailers: [] },
  [EPISODE]: { Id: EPISODE, Type: "Episode", SeriesId: SERIES, ProviderIds: { Tmdb: "62085" } },
  [SEASON]: { Id: SEASON, Type: "Season", SeriesId: SERIES },
  [BOXSET]: { Id: BOXSET, Type: "BoxSet", ProviderIds: { Tmdb: "726871" } },
  [HIDDEN]: { Id: HIDDEN, Type: "Movie", ProviderIds: { Tmdb: "1" } },
};

function jellyfin(path: string): Promise<JellyfinResult<unknown>> {
  const match = /^\/Items\/(\w+)\?userId=(\w+)&Fields=ProviderIds,RemoteTrailers$/.exec(path);
  if (!match) return Promise.resolve({ ok: false, failure: "invalid", status: 400 });
  const [, id, user] = match;
  // Bob ne voit pas le titre caché (bibliothèque non partagée) : Jellyfin rend 404.
  if (!(id in LIBRARY) || (id === HIDDEN && user === BOB)) return Promise.resolve({ ok: false, failure: "invalid", status: 404 });
  return Promise.resolve({ ok: true, data: LIBRARY[id] });
}

beforeEach(() => {
  resetPreviewTitles();
  jellyfinAdminFetch.mockReset();
  jellyfinAdminFetch.mockImplementation(jellyfin);
});

describe("titre d'un aperçu", () => {
  it("un film : ses bandes-annonces Jellyfin et son identifiant TMDB, sous une clé commune à tous les comptes", async () => {
    expect(await resolvePreviewTitle({ itemId: MOVIE }, ALICE)).toEqual({
      kind: "title",
      title: { key: `jf:${MOVIE}`, jellyfin: [{ Url: "https://youtu.be/abcdefghijk", Name: "Trailer" }], tmdb: { id: 438631, mediaType: "movie" } },
    });
    expect(jellyfinAdminFetch).toHaveBeenCalledWith(`/Items/${MOVIE}?userId=${ALICE}&Fields=ProviderIds,RemoteTrailers`, { timeoutMs: 5000 });
  });

  it("un épisode ou une saison valent leur série, lue au même nom", async () => {
    for (const itemId of [EPISODE, SEASON]) {
      const lookup = await resolvePreviewTitle({ itemId }, ALICE);
      expect(lookup).toEqual({ kind: "title", title: { key: `jf:${SERIES}`, jellyfin: [], tmdb: { id: 1396, mediaType: "tv" } } });
    }
    expect(jellyfinAdminFetch).toHaveBeenCalledWith(`/Items/${SERIES}?userId=${ALICE}&Fields=ProviderIds,RemoteTrailers`, { timeoutMs: 5000 });
  });

  it("une collection n'a pas de bande-annonce ; un titre inconnu non plus", async () => {
    expect(await resolvePreviewTitle({ itemId: BOXSET }, ALICE)).toEqual({ kind: "none" });
    expect(await resolvePreviewTitle({ itemId: "99999999999999999999999999999999" }, ALICE)).toEqual({ kind: "none" });
  });

  it("un titre que le compte ne voit pas n'existe pas pour lui — et la réponse d'un autre compte ne lui sert jamais", async () => {
    expect((await resolvePreviewTitle({ itemId: HIDDEN }, ALICE)).kind).toBe("title");
    expect(await resolvePreviewTitle({ itemId: HIDDEN }, BOB)).toEqual({ kind: "none" });
    expect(jellyfinAdminFetch).toHaveBeenCalledTimes(2);
  });

  it("gardé un moment par compte ; deux demandes simultanées partagent la lecture", async () => {
    await Promise.all([resolvePreviewTitle({ itemId: MOVIE }, ALICE), resolvePreviewTitle({ itemId: MOVIE }, ALICE)]);
    await resolvePreviewTitle({ itemId: MOVIE }, ALICE);
    expect(jellyfinAdminFetch).toHaveBeenCalledTimes(1);
  });

  it("Jellyfin muet : une panne passagère, jamais retenue", async () => {
    jellyfinAdminFetch.mockResolvedValueOnce({ ok: false, failure: "unreachable" });
    expect(await resolvePreviewTitle({ itemId: MOVIE }, ALICE)).toEqual({ kind: "error" });
    expect((await resolvePreviewTitle({ itemId: MOVIE }, ALICE)).kind).toBe("title");
  });

  it("un titre TMDB se passe de Jellyfin", async () => {
    expect(await resolvePreviewTitle({ tmdbId: "693134", mediaType: "movie" }, ALICE)).toEqual({
      kind: "title", title: { key: "tmdb:movie:693134", jellyfin: [], tmdb: { id: 693134, mediaType: "movie" } },
    });
    expect(jellyfinAdminFetch).not.toHaveBeenCalled();
  });
});
