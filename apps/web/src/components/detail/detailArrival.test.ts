/**
 * La porte d'arrivée de la fiche : elle ne s'ouvre qu'images réglées (prêtes
 * ou en échec) ou plafond atteint — et les adresses qu'elle décode sont
 * EXACTEMENT celles que la fiche montre, sinon on attendrait une image que
 * personne n'affiche pendant que la vraie surgit.
 */

import { describe, expect, it } from "vitest";
import type { JellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { arrivalReady, isImageCached } from "./detailArrival";
import { detailLogoUrl, detailPosterUrl } from "./detailArtUrls";

const client = {
  getImageUrl: (id: string, type: string, options: Record<string, unknown>) =>
    `/Items/${id}/Images/${type}?${Object.entries(options).map(([k, v]) => `${k}=${String(v)}`).join("&")}`,
} as unknown as JellyfinClient;

const item = (extra: Partial<MediaItem>): MediaItem => ({ Id: "x", Name: "X", Type: "Movie", ...extra }) as MediaItem;

describe("fiche › la porte d'arrivée", () => {
  it("fermée tant qu'une image se décode ; ouverte quand toutes sont réglées, échecs compris", () => {
    expect(arrivalReady(["ready", "pending"], false)).toBe(false);
    expect(arrivalReady(["ready", "settled"], false)).toBe(true);
    expect(arrivalReady([], false)).toBe(true);
  });

  it("le plafond l'ouvre quoi qu'il reste : un réseau lent ne retient jamais la fiche", () => {
    expect(arrivalReady(["pending", "pending"], true)).toBe(true);
  });

  it("sans moteur d'images (rendu serveur, tests), rien n'est « en mémoire »", () => {
    expect(isImageCached("/a.jpg")).toBe(false);
  });
});

describe("fiche › les adresses de ses images", () => {
  it("l'affiche d'un film en 600 px de haut, adressée par son tag ; la vignette d'un épisode en 832 de large", () => {
    expect(detailPosterUrl(client, item({ ImageTags: { Primary: "t1" } }))).toBe("/Items/x/Images/Primary?height=600&quality=90&tag=t1");
    expect(detailPosterUrl(client, item({ Type: "Episode", ImageTags: { Primary: "t2" } }))).toBe("/Items/x/Images/Primary?width=832&quality=90&tag=t2");
    expect(detailPosterUrl(client, item({}))).toBeNull();
  });

  it("le logo du titre, jamais celui d'un épisode (ce serait celui de la série)", () => {
    expect(detailLogoUrl(client, item({ ImageTags: { Logo: "l" } }))).toBe("/Items/x/Images/Logo?height=320&quality=90&tag=l");
    expect(detailLogoUrl(client, item({ Type: "Episode", ImageTags: { Logo: "l" } }))).toBeNull();
    expect(detailLogoUrl(client, item({}))).toBeNull();
  });
});
