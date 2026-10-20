/**
 * Quand redessiner l'activité en direct EN DEHORS d'un changement du lot : au
 * passage au premier plan ou en arrière-plan de l'application. Règle pure,
 * pour que la Live Activity d'iOS et la notification d'Android la suivent de
 * la même façon — et qu'elle se teste.
 *
 * Pourquoi. iOS ne laisse DÉMARRER une Live Activity qu'à une application au
 * premier plan, et un démarrage refusé (application déjà passée derrière,
 * activité coupée puis rallumée dans les réglages du téléphone) ne se
 * rattrapait jamais : la règle de publication (`livePublish.ts`) croyait
 * l'activité affichée et n'avait rien de neuf à dire — lot entier sans suivi.
 * Et derrière, le JavaScript est suspendu : ce qui n'a pas été publié avant
 * ne le sera pas avant le retour.
 *
 * - Retour au premier plan, une activité voulue mais pas visible : on la
 *   repose (c'est la seule fenêtre où iOS accepte de la démarrer).
 * - Passage en arrière-plan, une activité voulue : on republie l'état du
 *   moment (la barre que le pas de 5 % retenait encore), et l'on tente le
 *   démarrage s'il n'a pas pris — `inactive` précède `background` sur iOS,
 *   l'application y est encore visible.
 * - Activité fermée par la personne (balayée de l'écran verrouillé) : rien,
 *   jusqu'au prochain lot.
 */

/** Ce que la surface de la plateforme a fait du dernier dessin demandé. */
export type LiveSurfaceOutcome =
  /** Visible : posée ou mise à jour. */
  | "shown"
  /** Fermée par la personne : on ne la repose pas pour ce lot. */
  | "dismissed"
  /** Le système a refusé (arrière-plan, réglage coupé, permission) : à retenter. */
  | "refused"
  /** Pas encore de réponse du natif. */
  | "pending";

export type LiveAppState = "active" | "inactive" | "background" | "unknown" | "extension";

export type LiveAppStateAction = "none" | "republish";

export function liveAppStateAction(input: {
  appState: LiveAppState;
  /** Le lot a-t-il une activité à montrer (la règle de publication l'a posée) ? */
  wanted: boolean;
  outcome: LiveSurfaceOutcome;
}): LiveAppStateAction {
  if (!input.wanted || input.outcome === "dismissed") return "none";
  if (input.appState === "active") return input.outcome === "refused" ? "republish" : "none";
  if (input.appState === "inactive" || input.appState === "background") return "republish";
  return "none";
}

/** Un démarrage refusé au premier plan se retente au plus toutes les 10 s. */
export const LIVE_RETRY_MIN_INTERVAL_MS = 10_000;

/**
 * Faut-il redemander le dessin malgré « rien de neuf » pour la règle de
 * publication ? Seulement si le dernier dessin a été refusé et que l'app est
 * au premier plan : un évènement du moteur devient une nouvelle chance, sans
 * attendre le prochain pas de 5 % — mais pas une demande par évènement.
 */
export function liveRetryOnTick(input: {
  appState: LiveAppState;
  outcome: LiveSurfaceOutcome;
  sinceLastAttemptMs: number;
}): boolean {
  return (
    input.appState === "active" &&
    input.outcome === "refused" &&
    input.sinceLastAttemptMs >= LIVE_RETRY_MIN_INTERVAL_MS
  );
}
