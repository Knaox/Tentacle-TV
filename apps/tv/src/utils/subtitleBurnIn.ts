import { BURN_IN_SUBTITLE_CODECS } from "@tentacle-tv/shared";

/**
 * Codecs de sous-titres à INCRUSTER dans la vidéo (burn-in → transcodage) :
 * uniquement les pistes GRAPHIQUES (PGS / VOBSUB / DVBSUB), non rendables en
 * texte — sur toutes les plateformes.
 *
 * Tout sous-titre TEXTE est rendu SANS recharger le player : nativement
 * (ExoPlayer Android en direct play) ou par l'overlay JS (tvOS partout,
 * MPV/transcode Android). Le VTT Jellyfin est interprété par le parser
 * partagé (@tentacle-tv/shared) — gras/italique, ancrage {\an8}, balises
 * strippées — plus besoin du burn-in libass serveur pour l'ASS.
 */
export function isBurnInSubtitleCodec(codec?: string): boolean {
  return BURN_IN_SUBTITLE_CODECS.test(codec ?? "");
}
