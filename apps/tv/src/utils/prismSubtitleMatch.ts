import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { isBurnInSubtitleCodec } from "./subtitleBurnIn";
import type { PrismSubtitleRendition } from "./prismCoreStart";

/**
 * Index AVPlayer (groupe `legible`) de la rendition OCR que PrismCore a produite
 * pour un sous-titre IMAGE (PGS / DVB / VobSub), ou `null` si elle n'existe pas.
 *
 * Condition d'existence, lue dans PrismCore (`SubtitleRenditionSet.swift`) :
 * une piste bitmap n'est passée à l'OCR QUE si le conteneur ne porte AUCUNE
 * piste sous-titre texte embarquée. Sur un MKV avec SRT + PGS — le cas courant
 * — aucune rendition PGS : le burn-in serveur reste alors le seul chemin. En
 * contrepartie, quand la condition tient, tous les sous-titres embarqués sont
 * des bitmaps et le mapping est exact : k-ième bitmap Jellyfin (index de flux
 * croissant) ↔ k-ième rendition (`subsK/index.m3u8`), les renditions CC et
 * externes venant après.
 *
 * Les sous-titres TEXTE ne passent jamais par ici : ils restent l'overlay JS.
 */
export function prismBitmapRenditionIndex(a: {
  streams: JfStream[];
  subtitleIndex: number;
  renditions: PrismSubtitleRendition[];
}): number | null {
  if (a.subtitleIndex < 0 || a.renditions.length === 0) return null;
  const target = a.streams.find((s) => s.Type === "Subtitle" && s.Index === a.subtitleIndex);
  if (!target || target.IsExternal || !isBurnInSubtitleCodec(target.Codec)) return null;
  const embedded = a.streams.filter((s) => s.Type === "Subtitle" && !s.IsExternal);
  if (embedded.some((s) => !isBurnInSubtitleCodec(s.Codec))) return null;
  const bitmaps = embedded
    .filter((s) => isBurnInSubtitleCodec(s.Codec))
    .sort((x, y) => x.Index - y.Index);
  const k = bitmaps.findIndex((s) => s.Index === a.subtitleIndex);
  if (k < 0) return null;
  // Garde-fou : si PrismCore a sauté une piste, les ordinaux ne collent plus.
  const rendition = a.renditions[k];
  if (!rendition || !rendition.uri.startsWith(`subs${k}/`)) return null;
  return k;
}
