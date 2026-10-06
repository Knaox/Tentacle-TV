/**
 * L'ordre dans lequel la bannière d'accueil essaie les images de REPLI d'un
 * titre — module pur. Le contrat de la réponse est recopié dans
 * `packages/shared/src/hero/heroArtwork.ts` (`HeroArtwork`).
 */

/** Une image de repli : une adresse TMDB complète, ou une image Jellyfin. */
export type HeroArtwork =
  | { kind: "tmdb"; url: string }
  | { kind: "jellyfin"; itemId: string; type: string; index?: number; tag?: string };

/** Une entrée de `GET /Items/{id}/Images` (ce qu'on en lit). */
export interface JellyfinImageInfo {
  ImageType?: string;
  ImageIndex?: number | null;
  ImageTag?: string | null;
}

/**
 * Les types d'image qu'une bannière 16:9 peut montrer, du plus large au plus
 * étroit. Ni le logo (il est déjà le titre écrit), ni le disque, ni les
 * chapitres : rien de tout cela ne fait un décor.
 */
const TYPE_ORDER = ["Backdrop", "Thumb", "Primary", "Banner", "Art", "Screenshot", "Box"] as const;

export const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";

/**
 * Les images Jellyfin du titre puis de sa série (ou de son parent), rangées
 * par TYPE d'abord : un fond de la série vaut mieux que l'affiche de
 * l'épisode. À type égal, le titre avant sa série ; à titre égal, l'index.
 */
export function orderJellyfinImages(
  sources: Array<{ itemId: string; images: JellyfinImageInfo[] }>
): HeroArtwork[] {
  const out: HeroArtwork[] = [];
  for (const type of TYPE_ORDER) {
    for (const { itemId, images } of sources) {
      images
        .filter((image) => image.ImageType === type)
        .sort((a, b) => (a.ImageIndex ?? 0) - (b.ImageIndex ?? 0))
        .forEach((image) =>
          out.push({
            kind: "jellyfin",
            itemId,
            type,
            ...(typeof image.ImageIndex === "number" ? { index: image.ImageIndex } : {}),
            ...(image.ImageTag ? { tag: image.ImageTag } : {}),
          })
        );
    }
  }
  return out;
}

/** Le fond TMDB d'abord (le décor de référence), puis Jellyfin. */
export function heroArtworkList(tmdbBackdropPath: string | null, jellyfin: HeroArtwork[]): HeroArtwork[] {
  return tmdbBackdropPath ? [{ kind: "tmdb", url: `${TMDB_BACKDROP_BASE}${tmdbBackdropPath}` }, ...jellyfin] : jellyfin;
}
