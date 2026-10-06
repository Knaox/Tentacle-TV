import type { MediaItem } from "../types/media";
import { heroImageCandidates } from "./heroImage";

/**
 * Le visuel d'une diapositive de bannière à pile d'images (le miroir et le
 * mobile) — module pur. Ce qu'on sait du titre : son visuel LARGE annoncé
 * (fond ou vignette, `null` s'il n'en a pas), son affiche, et le repli du
 * serveur une fois demandé (`artwork` : le fond TMDB, puis toute image
 * Jellyfin du titre et de sa série ; `undefined` tant qu'il n'est pas là).
 */
export interface HeroSlideSourceInput {
  wide: string | null | undefined;
  poster: string | null | undefined;
  /** Carte plus haute que large : l'affiche d'abord. */
  portrait: boolean;
  artwork: readonly string[] | undefined;
  /** Les adresses qui ont déjà échoué. */
  failed: readonly string[];
}

const usable = (url: string | null | undefined, failed: readonly string[]): url is string => !!url && !failed.includes(url);

/**
 * Faut-il demander le repli au serveur ? En paysage, dès que le visuel large
 * manque ou échoue : un fond (TMDB, un autre fond) vaut mieux que l'affiche
 * recadrée. En portrait, seulement quand l'affiche ET le large manquent.
 */
export function heroSlideNeedsArtwork(input: Omit<HeroSlideSourceInput, "artwork">): boolean {
  const wideGone = !usable(input.wide, input.failed);
  return input.portrait ? wideGone && !usable(input.poster, input.failed) : wideGone;
}

/**
 * L'adresse à montrer, ou `null` (l'aplat et les voiles du cadre). Paysage :
 * le large, le repli, puis l'affiche — qui attend la réponse du repli plutôt
 * que d'être montrée puis remplacée sous les yeux. Portrait : l'affiche, le
 * large, puis le repli.
 */
export function heroSlideSource(input: HeroSlideSourceInput): string | null {
  const art = input.artwork ?? [];
  const waiting = heroSlideNeedsArtwork(input) && input.artwork === undefined;
  const order = input.portrait
    ? [input.poster, input.wide, ...art]
    : [input.wide, ...art, ...(waiting ? [] : [input.poster])];
  return order.find((url): url is string => usable(url, input.failed)) ?? null;
}

/** Le titre annonce-t-il un visuel LARGE (fond, fond de la série, vignette) ? */
export function hasWideHeroImage(item: MediaItem): boolean {
  return heroImageCandidates(item).some((ref) => ref.type === "Backdrop" || ref.type === "Thumb");
}
