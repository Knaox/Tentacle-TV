import type { RemoteIntent } from "../remote/intents";

/**
 * « Vous regardez encore ? » sur les téléviseurs — ce que la TÉLÉCOMMANDE y
 * fait, et où va le focus. Le minuteur, la question et la pause sont ceux de
 * toutes les plateformes (shared `stillWatchingSession`, api-client
 * `useStillWatching`) ; ici, seulement la traduction des intentions.
 *
 * - En lecture (`none`), TOUT appui prouve une présence : le compteur repart.
 * - Pendant la question, l'encart tient la télécommande comme un panneau : les
 *   flèches vont d'un bouton à l'autre, OK presse celui qui a le focus — un
 *   appui n'est PAS une réponse, sinon viser « Mettre en pause » répondrait
 *   « Continuer » avant même d'y être. Lecture/Pause (et la touche Pause
 *   d'Android TV) met en pause tout de suite, la touche Lecture répond
 *   « Continuer » ; Retour aussi (une couche du Retour, `playerBack`).
 * - En pause, seule la reprise en sort : « Reprendre », Lecture/Pause ou la
 *   touche Lecture. Retour n'y est plus une réponse : il suit la pile du
 *   lecteur (la sortie).
 *
 * Le focus ENTRE sur « Continuer », puis sur « Reprendre » : jamais sur la
 * pause, que l'on ne choisit pas sans le vouloir.
 */

export type StillWatchingTvPhase = "none" | "asking" | "paused";

/** Ce qu'un appui demande au contrôleur ; `null` : rien (le focus s'en charge). */
export type StillWatchingRemoteAnswer = "activity" | "keepWatching" | "pauseNow" | "resume" | null;

/** Les clés de focus de l'encart. */
export const STILL_WATCHING_TV_KEYS = {
  continue: "stillwatching:continue",
  pause: "stillwatching:pause",
  resume: "stillwatching:resume",
} as const;

/** Ce qu'une touche de lecture demande : basculer, lire, ou mettre en pause ; `null` pour le reste. */
function playbackKeyOf(intent: RemoteIntent): "toggle" | "play" | "pause" | null {
  if (intent.type === "playPause") return "toggle";
  if (intent.type !== "transport") return null;
  if (intent.command === "lecture") return "play";
  return intent.command === "pause" ? "pause" : null;
}

export function stillWatchingRemoteAnswer(phase: StillWatchingTvPhase, intent: RemoteIntent): StillWatchingRemoteAnswer {
  if (phase === "none") return "activity";
  const key = playbackKeyOf(intent);
  if (key === null) return null;
  if (phase === "asking") return key === "play" ? "keepWatching" : "pauseNow";
  return key === "pause" ? null : "resume";
}

/** Le bouton qui prend le focus à l'apparition de chaque phase ; `null` : aucun. */
export function stillWatchingFocusEntry(phase: StillWatchingTvPhase): string | null {
  if (phase === "asking") return STILL_WATCHING_TV_KEYS.continue;
  if (phase === "paused") return STILL_WATCHING_TV_KEYS.resume;
  return null;
}
