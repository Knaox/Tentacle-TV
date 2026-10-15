import type { MediaSource } from "../types/media";
import { playbackRefusal, streamConversions, type ConversionSource, type PlaybackRefusal, type PlaybackRights } from "./playbackRights";
import { exceedsBitrateCap } from "./rightsQuality";

/**
 * Les droits de lecture du compte face à ce qu'un LECTEUR s'apprête à demander
 * (docs/DROITS-UTILISATEURS.md § 9.2) — la règle partagée, appliquée AVANT de
 * rien demander, par le web, le bureau et les téléviseurs : un mode refusé
 * n'est jamais demandé en douce, et le lecteur dit pourquoi au lieu de
 * recevoir un flux illisible.
 */

/**
 * Le débit à demander : le palier choisi, borné au plafond de ce client
 * (distant et limité) ; en « Originale », le plafond seul. `undefined` : aucun.
 */
export function rightsBitrate(requested: number | undefined, rights: PlaybackRights | undefined): number | undefined {
  const cap = rights?.maxBitrate ?? null;
  if (cap === null) return requested;
  return requested === undefined ? cap : Math.min(requested, cap);
}

/**
 * Le refus que mérite la lecture négociée : le fichier tel quel (`directPlay`),
 * ou l'URL de conversion que Jellyfin rend (`transcodingPath`, telle qu'elle
 * partira) ; rien de jouable du tout, alors qu'une conversion est refusée au
 * compte : c'est elle qui manque. Sans droits connus : rien à juger.
 */
export function negotiatedRefusal(
  rights: PlaybackRights | undefined,
  source: ConversionSource,
  directPlay: boolean,
  transcodingPath: string | null,
): PlaybackRefusal | null {
  if (!rights) return null;
  if (!rights.mediaPlayback) return "playback_not_allowed";
  if (directPlay) return null;
  if (!transcodingPath) {
    const allConversions = rights.videoTranscoding && rights.audioTranscoding && rights.remuxing;
    return allConversions ? null : "conversion_not_allowed";
  }
  const [path, query = ""] = transcodingPath.replace(/^\/+/, "").split("?");
  const params = Object.fromEntries(new URLSearchParams(query));
  return playbackRefusal(rights, streamConversions(path, params, source));
}

/**
 * Le refus que mérite une URL de flux FABRIQUÉE par le lecteur (mpv : fichier
 * tel quel, ou palier par `planStream`) : la même règle que le proxy, jugée sur
 * le chemin `…/Videos/{id}/…` et sa query. Le fichier tel quel au-dessus du
 * plafond d'un client distant exigerait de réencoder l'image.
 */
export function builtUrlRefusal(
  rights: PlaybackRights,
  url: string,
  source: MediaSource | null | undefined,
): PlaybackRefusal | null {
  if (!rights.mediaPlayback) return "playback_not_allowed";
  const [base, query = ""] = url.split("?");
  const at = base.search(/\/(videos|audio)\//i);
  if (at < 0) return null;
  const params = Object.fromEntries(new URLSearchParams(query));
  const conversions = streamConversions(base.slice(at + 1), params, source ?? null);
  const refusal = playbackRefusal(rights, conversions);
  if (refusal) return refusal;
  const asIs = !conversions?.container;
  return asIs && !rights.videoTranscoding && exceedsBitrateCap(source, rights) ? "conversion_not_allowed" : null;
}

/**
 * Le refus connu AVANT toute requête, d'après la fiche seule : la lecture
 * interdite, ou un fichier au-dessus du plafond de ce client sans le droit de
 * le réencoder (aucun palier possible, cf. `rightsCapTier`). Le reste se juge
 * sur l'URL (`builtUrlRefusal`) ou la proposition de Jellyfin (`negotiatedRefusal`).
 */
export function upfrontRefusal(rights: PlaybackRights, source: MediaSource | null | undefined): PlaybackRefusal | null {
  if (!rights.mediaPlayback) return "playback_not_allowed";
  return !rights.videoTranscoding && exceedsBitrateCap(source, rights) ? "conversion_not_allowed" : null;
}
