import type { MediaItem, MediaStream } from "../types/media";

/**
 * Les badges de qualité d'un titre — la règle de toutes les plateformes
 * (l'Apple TV les montre au focus de ses cartes, et sur la fiche) :
 *
 * - « 4K » : une image d'au moins 3200 de large ou 2000 de haut — un 4K
 *   recadré en scope (3840 × 1600, 3832 × 1600) en est un, un 1440p non ;
 * - la plage dynamique, UNE seule : « Dolby Vision », à défaut « HDR10+ »,
 *   « HDR10 », ou « HDR » (HLG, toute autre plage qui n'est pas SDR) ;
 * - « Dolby Atmos » dès qu'UNE piste audio le dit (son profil ou son titre) :
 *   sur un fichier MULTi, l'Atmos est d'ordinaire sur la VO, pas sur la piste
 *   par défaut. Jamais déduit du codec — un TrueHD sans Atmos existe.
 *
 * Trois au plus, dans cet ordre ; aucun : la liste vide. Chacun a son nom
 * entier (la fiche) et sa forme courte, celle des puces du web (« VISION »),
 * pour une carte où la place manque. Le 4K seul porte l'accent de la marque.
 *
 * Les flux lus sont ceux de la source par défaut — `MediaSources[0]`, sinon
 * `MediaStreams` (ce que `Fields=MediaStreams` rend seul) : les mêmes que la
 * fiche. Le web garde ses puces (`mediaQuality`) : cette règle ne les touche
 * pas.
 */

export type QualityBadgeKind = "4k" | "dolbyVision" | "hdr10Plus" | "hdr10" | "hdr" | "dolbyAtmos";

export interface QualityBadge {
  readonly kind: QualityBadgeKind;
  /** Le nom entier : « Dolby Vision ». */
  readonly label: string;
  /** La forme courte, celle des puces du web : « VISION ». */
  readonly short: string;
  /** L'accent de la marque, à peine teinté — le 4K seul. */
  readonly accent: boolean;
}

const badge = (kind: QualityBadgeKind, label: string, short: string): QualityBadge =>
  Object.freeze({ kind, label, short, accent: kind === "4k" });

const BADGES: Readonly<Record<QualityBadgeKind, QualityBadge>> = {
  "4k": badge("4k", "4K", "4K"),
  dolbyVision: badge("dolbyVision", "Dolby Vision", "VISION"),
  hdr10Plus: badge("hdr10Plus", "HDR10+", "HDR10+"),
  hdr10: badge("hdr10", "HDR10", "HDR10"),
  hdr: badge("hdr", "HDR", "HDR"),
  dolbyAtmos: badge("dolbyAtmos", "Dolby Atmos", "ATMOS"),
};

/** Aucun badge : une seule liste vide, toujours la même. */
export const NO_QUALITY_BADGES: readonly QualityBadge[] = Object.freeze([]);

const MIN_4K_WIDTH = 3200;
const MIN_4K_HEIGHT = 2000;
const ATMOS = /\batmos\b/i;

function is4k(video: MediaStream | undefined): boolean {
  return (video?.Width ?? 0) >= MIN_4K_WIDTH || (video?.Height ?? 0) >= MIN_4K_HEIGHT;
}

/**
 * La plage dynamique d'une image. `VideoRangeType` arrive en chaîne, ou en
 * ENTIER sur certains points d'entrée de Jellyfin : on ne devine pas l'index
 * d'énumération, on s'en tient alors au profil Dolby Vision et au drapeau
 * HDR10+, et un HDR10 nu passe sans badge plutôt qu'un SDR avec.
 */
function dynamicRangeOf(video: MediaStream | undefined): QualityBadgeKind | null {
  if (!video) return null;
  const range = typeof video.VideoRangeType === "string" ? video.VideoRangeType.toUpperCase() : "";
  if (!range) {
    if (video.DvProfile != null) return "dolbyVision";
    return video.Hdr10PlusPresentFlag ? "hdr10Plus" : null;
  }
  // « DOVIInvalid » : une configuration Dolby Vision que Jellyfin juge
  // inexploitable — l'image reste en PQ, ce n'est pas du Dolby Vision.
  if (range === "DOVIINVALID") return "hdr";
  if (range.startsWith("DOVI")) return "dolbyVision";
  if (range === "HDR10PLUS" || (range === "HDR10" && video.Hdr10PlusPresentFlag)) return "hdr10Plus";
  if (range === "HDR10") return "hdr10";
  if (range === "HLG" || range.includes("HDR")) return "hdr";
  return null;
}

function hasAtmos(streams: readonly MediaStream[]): boolean {
  return streams.some((s) => s.Type === "Audio" && (ATMOS.test(s.Profile ?? "") || ATMOS.test(s.DisplayTitle ?? "")));
}

// Une liste par combinaison, toujours la même : deux titres de même qualité
// rendent le même tableau — une carte mémoïsée ne se redessine pas pour rien.
const combinations = new Map<string, readonly QualityBadge[]>();

function listOf(kinds: QualityBadgeKind[]): readonly QualityBadge[] {
  if (kinds.length === 0) return NO_QUALITY_BADGES;
  const key = kinds.join("|");
  let list = combinations.get(key);
  if (!list) {
    list = Object.freeze(kinds.map((kind) => BADGES[kind]));
    combinations.set(key, list);
  }
  return list;
}

/** Les badges que disent ces flux — dans l'ordre : 4K, plage, Atmos. */
export function qualityBadgesOfStreams(streams: readonly MediaStream[]): readonly QualityBadge[] {
  const video = streams.find((s) => s.Type === "Video");
  const kinds: QualityBadgeKind[] = [];
  if (is4k(video)) kinds.push("4k");
  const range = dynamicRangeOf(video);
  if (range) kinds.push(range);
  if (hasAtmos(streams)) kinds.push("dolbyAtmos");
  return listOf(kinds);
}

/** Les flux de la source par défaut ; `undefined` : l'item ne les porte pas. */
export function defaultMediaStreams(item: MediaItem | null | undefined): readonly MediaStream[] | undefined {
  const source = item?.MediaSources?.[0];
  if (source) return source.MediaStreams ?? [];
  return item?.MediaStreams;
}

/**
 * Les badges d'un titre, s'ils se lisent sans requête de plus : `undefined`
 * quand l'item ne porte pas ses flux (une grille, une série) — à lire à la
 * demande, ou à taire.
 */
export function qualityBadgesOf(item: MediaItem | null | undefined): readonly QualityBadge[] | undefined {
  const streams = defaultMediaStreams(item);
  return streams ? qualityBadgesOfStreams(streams) : undefined;
}

/**
 * Ce qui tient dans `maxWidth` : les badges dans leur ordre, les derniers
 * retirés jusqu'à ce que la rangée tienne — le 4K d'abord. `widthOf` mesure
 * une rangée telle que la plateforme la dessine (sa police, ses marges, la
 * forme qu'elle choisit) ; rien ne tient : la liste vide.
 */
export function fitQualityBadges(
  badges: readonly QualityBadge[],
  maxWidth: number,
  widthOf: (badges: readonly QualityBadge[]) => number,
): readonly QualityBadge[] {
  for (let count = badges.length; count > 0; count--) {
    const kept = count === badges.length ? badges : badges.slice(0, count);
    if (widthOf(kept) <= maxWidth) return kept;
  }
  return NO_QUALITY_BADGES;
}
