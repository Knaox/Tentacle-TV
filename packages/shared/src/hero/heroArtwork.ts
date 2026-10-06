import type { MediaItem } from "../types/media";
import { heroImageCandidates, heroImageKey, type HeroImageRef, type HeroImageType } from "./heroImage";

/**
 * Une image de REPLI servie par `GET /api/hero/artwork/:itemId` — contrat
 * recopié de `apps/backend/src/services/heroArtwork/heroArtworkOrder.ts`.
 */
export type HeroArtwork =
  | { kind: "tmdb"; url: string }
  | { kind: "jellyfin"; itemId: string; type: string; index?: number; tag?: string };

/** Une image que la bannière peut essayer : une image Jellyfin, ou une adresse complète (TMDB). */
export type HeroImageOption =
  | { key: string; ref: HeroImageRef; url?: undefined }
  | { key: string; url: string; ref?: undefined };

const KNOWN_TYPES: readonly string[] = ["Backdrop", "Primary", "Thumb", "Banner", "Art", "Screenshot", "Box"];
const WIDE: readonly HeroImageType[] = ["Backdrop", "Thumb"];

const option = (ref: HeroImageRef): HeroImageOption => ({ key: heroImageKey(ref), ref });

function artworkOption(art: HeroArtwork): HeroImageOption | null {
  if (art.kind === "tmdb") return { key: art.url, url: art.url };
  if (!KNOWN_TYPES.includes(art.type)) return null;
  return option({ id: art.itemId, type: art.type as HeroImageType, index: art.index, tag: art.tag });
}

/**
 * Le plan d'images d'un titre pour la bannière d'accueil, dans l'ordre où
 * elle les essaie :
 *
 * 1. les images LARGES que la donnée annonce (fond, fond de la série,
 *    vignette) ;
 * 2. le REPLI du serveur, une fois connu (`artwork`) : le fond TMDB, puis
 *    toute image que Jellyfin a du titre et de sa série ;
 * 3. l'affiche annoncée, en dernier recours.
 *
 * Une image déjà essayée n'y figure qu'une fois.
 */
export function heroImagePlan(item: MediaItem, artwork?: readonly HeroArtwork[]): HeroImageOption[] {
  const announced = heroImageCandidates(item);
  const options = [
    ...announced.filter((ref) => WIDE.includes(ref.type)).map(option),
    ...(artwork ?? []).map(artworkOption).filter((o): o is HeroImageOption => o !== null),
    ...announced.filter((ref) => !WIDE.includes(ref.type)).map(option),
  ];
  const seen = new Set<string>();
  return options.filter((o) => (seen.has(o.key) ? false : (seen.add(o.key), true)));
}

/** La première image du plan qui n'a pas échoué, ou `null`. */
export function heroImageOption(plan: readonly HeroImageOption[], failed: ReadonlySet<string>): HeroImageOption | null {
  return plan.find((o) => !failed.has(o.key)) ?? null;
}

/**
 * Faut-il demander le repli au serveur ? Quand le titre n'a plus aucune image
 * LARGE annoncée qui n'ait pas échoué — l'affiche seule ne fait pas un décor
 * de bannière tant qu'un fond peut exister ailleurs (TMDB, un autre fond).
 */
export function needsHeroArtwork(item: MediaItem, failed: ReadonlySet<string>): boolean {
  return !heroImageCandidates(item).some((ref) => WIDE.includes(ref.type) && !failed.has(heroImageKey(ref)));
}
