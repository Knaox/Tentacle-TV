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
