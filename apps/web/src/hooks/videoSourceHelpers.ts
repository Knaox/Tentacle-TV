import type { HlsConfig } from "hls.js";

const DBG = "[Tentacle:VideoPlayer]";

/**
 * Constantes et helpers de `useVideoSource`. Extraction mécanique (limite
 * 300 lignes/fichier), comportement inchangé.
 */

/** Safari-only: native HLS support detected via canPlayType.
 *  Returns "" on Chrome/Brave/Firefox/Edge → all Safari-specific code paths are inert. */
export const HAS_NATIVE_HLS = typeof document !== "undefined"
  && document.createElement("video").canPlayType("application/vnd.apple.mpegurl") !== "";

/** Max time (ms) to wait for canplaythrough before falling back to play anyway.
 *  Progressive transcode: video=copy is instant but audio transcode takes 1-3s.
 *  canplaythrough fires when the browser has decoded enough audio+video. */
export const BUFFER_GATE_TIMEOUT = 8_000;

/**
 * Filet de la lecture directe : Chromium accepte parfois un conteneur qu'il ne
 * sait pas démuxer et se fige sur une image noire, sans erreur ni événement —
 * le mode d'échec de jellyfin-web #7651. Trois secondes de silence valent donc
 * échec, très en amont du `failsafe` de 15 s qui, lui, se contente d'afficher
 * un bouton de lecture à un utilisateur déjà perdu.
 */
export const GARDE_DIRECT_PLAY_MS = 3_000;

/**
 * Configuration de hls.js. Extraction mécanique de `useVideoSource` (limite
 * 300 lignes/fichier), à une addition près : `videoPreference`.
 *
 * ⚠️ `preferHDR` est la ligne qui décide de la COPIE ou du RÉ-ENCODAGE.
 *
 * Pour une source HDR, le manifeste maître de Jellyfin propose plusieurs
 * variantes : la principale, où l'image est copiée, et des replis SDR
 * « backward compatibility » que le serveur marque `AllowVideoStreamCopy=false`
 * et force en profil Main 8 bits. Toutes annoncent le MÊME débit — Jellyfin
 * l'assume dans `DynamicHlsHelper` : « HACK: Use the same bitrate so that the
 * client can choose by other attributes, such as color range ».
 *
 * hls.js départage donc sur la plage dynamique, et par défaut il écarte le HDR
 * quand l'écran ne l'annonce pas. Sur un écran SDR il prenait le repli, et
 * `AllowVideoStreamCopy=false` sort en TÊTE de `CanStreamCopyVideo` :
 *
 *     if (!request.AllowVideoStreamCopy) return false;
 *
 * D'où un ré-encodage 4K que rien dans le DeviceProfile ne pouvait expliquer —
 * et qui a résisté à tout ce qu'on y a changé, puisque la décision se prenait
 * une couche plus bas, au choix de la variante.
 *
 * Même réglage que jellyfin-web (`htmlVideoPlayer/plugin.js`). Le prix est le
 * même que celui déjà accepté pour les plages dynamiques du profil : sur un
 * écran SDR, c'est Chromium qui tone-mappe à l'affichage plutôt que le serveur
 * qui recompresse.
 */
export function configHls(seekTo: number): Partial<HlsConfig> {
  return {
    enableWorker: true,
    startPosition: seekTo > 0 ? seekTo : -1, // Seek to saved position in absolute-PTS manifest
    lowLatencyMode: false,        // jellyfin-web pattern: disable low-latency mode
    videoPreference: { preferHDR: true },
    // Les sous-titres sont des <track> VTT sidecar gérés par React
    // (useNativeMediaTracks) : hls.js ne doit ni créer ni piloter de
    // TextTracks natifs — sinon il écrase les modes des pistes manuelles
    // (hls.js #4032) et les sous-titres disparaissent en transcode.
    renderTextTracksNatively: false,
    backBufferLength: Infinity,    // VOD: keep all played segments — instant backward seek
    maxBufferLength: 30,          // buffer 30s ahead for smooth playback
    maxMaxBufferLength: 120,      // allow up to 120s buffer for sustained streaming
    startFragPrefetch: true,      // prefetch next fragment during current load
    // A/V sync: fix audio desync with transcoded streams (fMP4/TS segments).
    // stretchShortVideoTrack extends the last audio frame to fill micro-gaps between segments.
    // maxAudioFramesDrift forces audio resync when drift exceeds 1 frame.
    // forceKeyFrameOnDiscontinuity forces keyframe at discontinuity points (seek, segment switch).
    stretchShortVideoTrack: true,
    maxAudioFramesDrift: 1,
    forceKeyFrameOnDiscontinuity: true,
    fragLoadPolicy: {
      default: {
        maxTimeToFirstByteMs: 20_000,
        maxLoadTimeMs: 60_000,
        timeoutRetry: { maxNumRetry: 5, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
        errorRetry: { maxNumRetry: 8, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
      },
    },
  };
}

export function attemptPlay(
  v: HTMLVideoElement, onPolicyMuted: () => void, onPlayFailed: () => void,
) {
  // Respecte le mute choisi par l'utilisateur (persisté) — sinon un changement
  // d'épisode/média rétablirait le son (gênant à 2 players sur une machine).
  const wantMuted = localStorage.getItem("tentacle_player_muted") === "1";
  v.muted = wantMuted;
  v.play().catch(() => {
    v.muted = true;
    v.play().then(() => { if (!wantMuted) onPolicyMuted(); }).catch((err) => {
      console.error(DBG, "muted play also failed:", err);
      onPlayFailed();
    });
  });
}
