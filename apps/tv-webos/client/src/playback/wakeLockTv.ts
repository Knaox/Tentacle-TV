/**
 * Anti-veille du téléviseur pendant une lecture.
 *
 * webOS arme son écran de veille sur l'inactivité de la télécommande — un film
 * regardé sans toucher à rien EST de l'inactivité, et l'économiseur tombe au
 * milieu de la lecture. Le service Luna `tvpower` expose l'antidote officiel :
 * `turnOffScreenSaver`, à rappeler périodiquement (l'effet est ponctuel, pas
 * permanent — c'est voulu par LG : une app morte cesse d'insister et la veille
 * reprend ses droits).
 *
 * Arbitrage produit : on n'insiste QUE pendant une lecture ACTIVE — une
 * `<video>` présente, ni en pause ni terminée. En pause, la TV garde la main
 * (protection des dalles OLED contre l'image fixe). Période de quatre minutes :
 * sous le délai minimal de l'économiseur LG (cinq minutes), assez espacée pour
 * être invisible dans les relevés de performance.
 *
 * Même pont que `configsTv.ts` : `PalmServiceBridge` survit à la navigation de
 * la coquille vers la page servie en HTTP (cf. globals.d.ts). Service absent
 * (émulateur, navigateur de dev, webOS antique) → no-op silencieux.
 */

const PERIOD_MS = 4 * 60_000;

let started = false;

/** Vrai si une lecture est ACTIVE à l'écran (vidéo montée, ni pause ni fin). */
function playbackActive(): boolean {
  const video = document.querySelector("video");
  return video != null && !video.paused && !video.ended;
}

function clearScreensaver(): void {
  const bridge = window.PalmServiceBridge;
  if (typeof bridge !== "function") return;
  try {
    const service = new bridge();
    // Réponse ignorée : l'appel est idempotent et sans retour utile — un refus
    // (service absent) ne change rien à la lecture en cours.
    service.onservicecallback = null;
    service.call("luna://com.webos.service.tvpower/power/turnOffScreenSaver", JSON.stringify({}));
  } catch {
    // Le pont existe mais refuse l'appel : la veille système s'appliquera.
  }
}

/** Installe la sentinelle (idempotent, no-op hors téléviseur). */
export function installWakeLock(): void {
  if (started) return;
  started = true;
  if (typeof window === "undefined" || typeof window.PalmServiceBridge !== "function") return;
  setInterval(() => {
    if (playbackActive()) clearScreensaver();
  }, PERIOD_MS);
}
