import type { HlsConfig } from "hls.js";
import { TRAILER_PREVIEW_TIMING } from "@tentacle-tv/shared";

/** La configuration hls.js d'un aperçu (`previewSource.ts`) : départ, tampon, délais. */

/**
 * L'estimation de débit de départ (bit/s), avant toute mesure : celle d'une
 * connexion domestique ordinaire. Sans elle, hls.js part de 500 kbit/s et
 * pourrait juger la 1080p trop lourde avant d'avoir mesuré quoi que ce soit.
 */
export const PREVIEW_START_BANDWIDTH_ESTIMATE = 8_000_000;

/** Des délais courts : un aperçu qui traîne n'est pas montré (la machine abandonne à `readyTimeoutMs`). */
const PREVIEW_LOAD_POLICY = {
  default: {
    maxTimeToFirstByteMs: 6_000,
    maxLoadTimeMs: 15_000,
    timeoutRetry: { maxNumRetry: 1, retryDelayMs: 0, maxRetryDelayMs: 0 },
    errorRetry: { maxNumRetry: 1, retryDelayMs: 500, maxRetryDelayMs: 1_000 },
  },
};

/**
 * Le tampon d'avance : AVANT la révélation, une seconde — le premier segment
 * (celui que le serveur a lu d'avance), rien de plus : un survol qui s'arrête
 * avant la révélation n'a pas téléchargé trente secondes de 1080p. Une fois
 * montrée (`unleash`), douze secondes, quinze au plus (hls.js porte sinon le
 * tampon à 60 Mo, soit trente secondes, quel que soit `maxBufferLength`).
 */
export const PREVIEW_PRELOAD_BUFFER_S = 1;
export const PREVIEW_PLAY_BUFFER_S = 12;
export const PREVIEW_PLAY_MAX_BUFFER_S = 15;

/**
 * La configuration hls.js d'un aperçu. La qualité est celle de la BOÎTE :
 * départ et plafond au plus petit niveau qui couvre la mini-carte en pixels
 * de l'écran (`previewLevelCap.ts`, posé au manifeste et suivi si la boîte
 * change) — le plafond automatique de hls.js (`capLevelToPlayerSize`) lirait
 * la boîte encore réduite de l'animation d'entrée. L'ABR ne descend sous ce
 * plafond que si le débit mesuré l'impose. Un tampon court (cf. plus haut).
 */
export function previewHlsConfig(): Partial<HlsConfig> {
  return {
    autoStartLoad: false,
    startPosition: TRAILER_PREVIEW_TIMING.startOffsetS,
    capLevelToPlayerSize: false,
    capLevelOnFPSDrop: false,
    enableWorker: true,
    lowLatencyMode: false,
    testBandwidth: false,
    abrEwmaDefaultEstimate: PREVIEW_START_BANDWIDTH_ESTIMATE,
    maxBufferLength: PREVIEW_PRELOAD_BUFFER_S,
    maxMaxBufferLength: PREVIEW_PRELOAD_BUFFER_S,
    backBufferLength: 0,
    startFragPrefetch: true,
    // Pas de sous-titres dans un aperçu.
    renderTextTracksNatively: false,
    enableWebVTT: false,
    enableIMSC1: false,
    enableCEA708Captions: false,
    manifestLoadPolicy: PREVIEW_LOAD_POLICY,
    playlistLoadPolicy: PREVIEW_LOAD_POLICY,
    fragLoadPolicy: PREVIEW_LOAD_POLICY,
  };
}
