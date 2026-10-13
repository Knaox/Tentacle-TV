import { TRAILER_PREVIEW_TIMING } from "@tentacle-tv/shared";

/**
 * Les bandes-annonces qui ont LÂCHÉ à la lecture sur cet appareil (erreur
 * fatale, blocage avant la première image) : le serveur les a vérifiées, mais
 * la lecture a échoué ici. On ne les retente pas avant `failureMemoryMs` — un
 * survol suivant ne remonte pas une vidéo vouée à l'échec. Mémoire de la
 * session seulement (un redémarrage efface tout).
 */
const failures = new Map<string, number>();

export function rememberTrailerPreviewFailure(subjectKey: string, now: number = Date.now()): void {
  failures.set(subjectKey, now + TRAILER_PREVIEW_TIMING.failureMemoryMs);
}

export function trailerPreviewRecentlyFailed(subjectKey: string | null, now: number = Date.now()): boolean {
  if (subjectKey === null) return false;
  const until = failures.get(subjectKey);
  if (until === undefined) return false;
  if (until > now) return true;
  failures.delete(subjectKey);
  return false;
}

/** Pour les tests. */
export function forgetTrailerPreviewFailures(): void {
  failures.clear();
}
