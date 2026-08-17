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

const PERIODE_MS = 4 * 60_000;

let demarre = false;

/** Vrai si une lecture est ACTIVE à l'écran (vidéo montée, ni pause ni fin). */
function lectureActive(): boolean {
  const video = document.querySelector("video");
  return video != null && !video.paused && !video.ended;
}

function effacerEconomiseur(): void {
  const pont = window.PalmServiceBridge;
  if (typeof pont !== "function") return;
  try {
    const appel = new pont();
    // Réponse ignorée : l'appel est idempotent et sans retour utile — un refus
    // (service absent) ne change rien à la lecture en cours.
    appel.onservicecallback = null;
    appel.call("luna://com.webos.service.tvpower/power/turnOffScreenSaver", JSON.stringify({}));
  } catch {
    // Le pont existe mais refuse l'appel : la veille système s'appliquera.
  }
}

/** Installe la sentinelle (idempotent, no-op hors téléviseur). */
export function installerAntiVeille(): void {
  if (demarre) return;
  demarre = true;
  if (typeof window === "undefined" || typeof window.PalmServiceBridge !== "function") return;
  setInterval(() => {
    if (lectureActive()) effacerEconomiseur();
  }, PERIODE_MS);
}
