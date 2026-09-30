import type { JellyfinClient } from "@tentacle-tv/api-client";
import { resolveBannerImage, type MediaItem } from "@tentacle-tv/shared";
import { isLogoLegibleOnDark } from "../../redesign/color/artworkPalette";
import { blurHashOf } from "../cards/cardArtwork";

/**
 * Les images de la fiche refondue. Les tailles sont en PIXELS : l'Apple TV 4K
 * rend à ×2 et le client n'applique aucune densité sur le téléviseur — on
 * demande donc le double des points affichés, sauf pour le fond (plein cadre,
 * sous ses voiles : 1920 suffisent). Une image que la donnée dit absente n'est
 * jamais demandée : pas de 404 à la chaîne sur une fiche pauvre.
 */

const BACKDROP_WIDTH = 1920;
/** Le logo tient dans 680 × 210 points. */
const LOGO_HEIGHT = 420;
/** La vignette d'épisode : 460 points de large. */
const STILL_WIDTH = 920;
/** Le portrait rond : 176 points. */
const PORTRAIT_WIDTH = 352;
/** La vignette d'un extra : 380 points de large. */
const EXTRA_WIDTH = 760;

const withTag = (tag: string | undefined) => (tag ? { tag } : {});

/**
 * Le fond plein cadre : celui de l'œuvre (sinon celui dont elle hérite) ;
 * pour un épisode, SON image 16:9, sinon le fond de sa série
 * (`resolveBannerImage`). Jamais une affiche 2:3 étirée : sans fond, la
 * lumière de l'œuvre suffit.
 */
export function detailBackdropUri(client: JellyfinClient, item: MediaItem): string | undefined {
  const options = { width: BACKDROP_WIDTH, quality: 80 };
  if (item.Type === "Episode") {
    const image = resolveBannerImage(item);
    return image ? client.getImageUrl(image.id, image.type, { ...options, ...withTag(image.tag) }) : undefined;
  }
  const own = item.BackdropImageTags?.[0];
  if (own) return client.getImageUrl(item.Id, "Backdrop", { ...options, tag: own });
  const inherited = item.ParentBackdropImageTags?.[0];
  if (inherited && item.ParentBackdropItemId) {
    return client.getImageUrl(item.ParentBackdropItemId, "Backdrop", { ...options, tag: inherited });
  }
  return undefined;
}

/**
 * Le logo : celui de l'œuvre ; celui de la SÉRIE sur une fiche d'épisode
 * (hérité : `ParentLogoItemId`). Un logo noir de part en part ne se lit pas
 * sur la scène : il cède au titre écrit (`isLogoLegibleOnDark`).
 */
export function detailLogoUri(client: JellyfinClient, item: MediaItem): string | undefined {
  const inherited = item as { ParentLogoItemId?: string; ParentLogoImageTag?: string };
  const own = item.ImageTags?.Logo;
  const id = own ? item.Id : inherited.ParentLogoItemId;
  const tag = own ?? inherited.ParentLogoImageTag;
  if (!id || !tag) return undefined;
  if (!isLogoLegibleOnDark(blurHashOf(item, "Logo"))) return undefined;
  return client.getImageUrl(id, "Logo", { height: LOGO_HEIGHT, tag });
}

/** L'image d'un épisode, seulement s'il en a une : sans elle, la vignette dit son numéro. */
export function episodeStillUri(client: JellyfinClient, episode: MediaItem): string | undefined {
  const tag = episode.ImageTags?.Primary;
  return tag ? client.getImageUrl(episode.Id, "Primary", { width: STILL_WIDTH, quality: 80, tag }) : undefined;
}

export function portraitUri(client: JellyfinClient, person: { Id: string; PrimaryImageTag?: string }): string | undefined {
  return person.PrimaryImageTag
    ? client.getImageUrl(person.Id, "Primary", { width: PORTRAIT_WIDTH, quality: 85, tag: person.PrimaryImageTag })
    : undefined;
}

/** La vignette d'un extra LOCAL (fichier du serveur) ; une vidéo distante porte la sienne. */
export function localExtraUri(client: JellyfinClient, itemId: string): string {
  return client.getImageUrl(itemId, "Primary", { width: EXTRA_WIDTH, quality: 80 });
}
