/**
 * Ce que fait le lecteur quand l'application change de PRÉSENCE — Apple TV,
 * Android TV (et toute cible qui sait dire « regardée / masquée / quittée »).
 *
 * - `inactive` : l'app est encore à l'écran mais ne reçoit plus la
 *   télécommande — centre de contrôle (appui long sur TV), Siri, sélecteur
 *   d'apps, début d'un appui sur TV. On met en PAUSE et on remonte la
 *   POSITION, sans clore la session : la refermer coupait le transcodage et
 *   faisait disparaître la lecture du tableau de bord pour un simple coup
 *   d'œil au centre de contrôle. Tuée depuis le sélecteur, l'app ne passe
 *   jamais par `background` — la position est déjà partie.
 * - `background` : l'app est quittée (accueil, veille, autre app) et sera
 *   suspendue dans les secondes qui suivent. On ARRÊTE la session, à la
 *   position finale : les autres appareils la reprennent là.
 * - retour à `active` : le focus va à Lecture — l'app a mis en pause d'elle-même,
 *   un OK doit reprendre (le focus natif meurt avec la suspension, et tvOS le
 *   posait sinon sur le premier bouton : « Reculer de 10 s »). Après une vraie
 *   absence, la session est rouverte et le flux local contrôlé : une suspension
 *   peut avoir tué son serveur.
 */

export type AppPresence = "active" | "inactive" | "background";

export interface PresenceStep {
  /** Mettre la lecture en pause. */
  pause: boolean;
  /** Ce qui part vers le serveur : rien, la position (session gardée), l'arrêt
   *  (session close), ou la réouverture de la session au retour. */
  report: "none" | "position" | "stop" | "reopen";
  /** Rendre le focus au bouton Lecture. */
  focusPlay: boolean;
  /** Vérifier que le flux répond encore (et le relancer sinon). */
  checkStream: boolean;
}

const NOTHING: PresenceStep = { pause: false, report: "none", focusPlay: false, checkStream: false };

/** Une valeur d'`AppState` inconnue (`unknown`, `extension`) ne compte pas. */
export function presenceOf(state: string): AppPresence | null {
  return state === "active" || state === "inactive" || state === "background" ? state : null;
}

export function presenceStep(from: AppPresence, to: AppPresence): PresenceStep {
  if (from === to) return NOTHING;
  if (to === "inactive") {
    // Seulement depuis l'écran : un retour passe directement de `background` à `active`.
    return from === "active" ? { pause: true, report: "position", focusPlay: false, checkStream: false } : NOTHING;
  }
  if (to === "background") return { pause: true, report: "stop", focusPlay: false, checkStream: false };
  // Retour à l'écran.
  return from === "background"
    ? { pause: false, report: "reopen", focusPlay: true, checkStream: true }
    : { pause: false, report: "none", focusPlay: true, checkStream: false };
}
