/**
 * L'Allégé AUDIO : ce que le mode Allégé de l'administration vaut pour la
 * MUSIQUE gardée hors ligne (Octave, bureau, capacité `offline.music`).
 *
 * Un réencodage à un débit audio raisonnable — AAC 256 kb/s — dans un MP4
 * FRAGMENTÉ, tel que Jellyfin le rend en flux (`Audio/{id}/stream.m4a`,
 * `static=false`) : mesuré sur Jellyfin 10.11.11 (banc d'Octave, 25/10), l'index
 * (`moov` + `mvex`) arrive EN TÊTE, le fichier est valide et sa durée connue
 * dès qu'il est complet — le piège du `moov` final de la vidéo
 * (`lightStream.ts`) n'existe pas ici. Un FLAC de 20 s y passe en 0,24 s.
 *
 * Il ne vaut que pour une source qui y gagne (sans perte, ou au-delà de
 * 320 kb/s) : réencoder un MP3 ne ferait que l'abîmer. Sinon, l'original.
 */

import { ITEM_ID_RE } from "./lightStream";

export interface AudioPreset {
  audioCodec: string;
  audioBitRate: number;
  /** Le conteneur demandé à Jellyfin (`stream.<container>`). */
  container: "m4a";
}

/** Les paliers de l'Allégé audio. `a256` : AAC 256 kb/s. Un identifiant ne se renomme pas (il nomme des fichiers). */
export const AUDIO_PRESETS: Record<string, AudioPreset> = {
  a256: { audioCodec: "aac", audioBitRate: 256_000, container: "m4a" },
};

export const DEFAULT_AUDIO_PRESET = "a256";

/** Au-delà, une source avec perte est assez lourde pour que l'Allégé y gagne. */
const LOSSY_LIGHT_FLOOR_BPS = 320_000;

export interface AudioLightRequest {
  itemId: string;
  presetId: string;
  preset: AudioPreset;
}

/** La demande d'un Allégé AUDIO lue dans l'URL ; `null` si ce n'en est pas une. */
export function parseAudioLightRequest(itemId: string, query: Record<string, string | undefined>): AudioLightRequest | null {
  const presetId = query.preset ?? "";
  const preset = Object.prototype.hasOwnProperty.call(AUDIO_PRESETS, presetId) ? AUDIO_PRESETS[presetId] : undefined;
  if (!preset || !ITEM_ID_RE.test(itemId)) return null;
  return { itemId, presetId, preset };
}

/** La requête de Jellyfin pour cette demande et cette session de transcodage. */
export function audioStreamPath(request: AudioLightRequest, session: { playSessionId: string; deviceId: string }): string {
  const params = new URLSearchParams({
    static: "false",
    container: request.preset.container,
    audioCodec: request.preset.audioCodec,
    audioBitRate: String(request.preset.audioBitRate),
    mediaSourceId: request.itemId,
    deviceId: session.deviceId,
    playSessionId: session.playSessionId,
  });
  return `/Audio/${encodeURIComponent(request.itemId)}/stream.${request.preset.container}?${params.toString()}`;
}

/** Ce qu'il faut savoir d'une source pour choisir : sans perte, et son débit. */
export interface AudioSourceFacts {
  lossless: boolean;
  bitrate: number | null;
}

/** L'Allégé y gagne-t-il ? Sans perte, ou plus lourd que le plancher. */
export function lightPaysOff(source: AudioSourceFacts): boolean {
  return source.lossless || (source.bitrate !== null && source.bitrate > LOSSY_LIGHT_FLOOR_BPS);
}

/** L'estimation d'un Allégé audio (octets), marge de conteneur comprise — le contrôle d'espace. */
export function audioLightEstimate(durationMs: number | null, preset: AudioPreset): number | null {
  if (durationMs === null || durationMs <= 0) return null;
  return Math.ceil(((durationMs / 1000) * preset.audioBitRate) / 8 * 1.05);
}
