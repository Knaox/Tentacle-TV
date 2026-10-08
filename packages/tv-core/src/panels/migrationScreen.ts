/**
 * L'ÉCRAN D'ATTENTE de la migration de la base du serveur (1.25), sur les
 * téléviseurs — la décision, pure. Le CE QUI s'affiche (la vue, son échec,
 * la capacité du serveur) est la règle commune de tous les clients
 * (api-client `useDatabaseMigrationGate`) ; ici, le COMMENT sur une TV :
 *
 * - l'écran REMPLACE les écrans de l'application, qui restent montés pour
 *   React mais sans vue native (`display: none`, le patron de `ScreenReveal`) :
 *   rien d'en dessous ne se dessine ni ne prend le focus, et la pile d'écrans
 *   revient intacte au retour du serveur ;
 * - il n'a RIEN de focalisable : rien ne s'y décide, il se met à jour et
 *   s'efface seul — la télécommande y est muette, sauf Menu / Retour, jamais
 *   pris : l'application quitte vers l'accueil du système (la règle qu'App
 *   Review vérifie ; Android TV par `exitOnBack`, comme le voile hors ligne) ;
 * - il CÈDE au lecteur, comme le voile hors ligne : un film en lecture directe
 *   continue sans Tentacle, et le lecteur dit lui-même ce qui lui manque. À la
 *   sortie, l'écran paraît si la migration dure ;
 * - ce n'est jamais une panne : tant qu'une migration est dite, le voile hors
 *   ligne ne se pose pas.
 */

export interface MigrationScreenInput {
  /** La porte commune rend une vue (migration en cours ou en échec). */
  migrating: boolean;
  /** Un écran de lecture (lecteur, bande-annonce) est au premier plan. */
  playbackShown: boolean;
}

export interface MigrationScreenDecision {
  /** L'écran d'attente est rendu. */
  show: boolean;
  /** Les écrans de l'application passent sans vue native. */
  hideScreens: boolean;
  /** Le voile hors ligne a le droit de paraître. */
  offlineVeilAllowed: boolean;
  /** Android TV : Retour quitte l'application au lieu d'agir sur l'écran caché. */
  exitOnBack: boolean;
}

/** Ce que l'écran déclare au moteur de focus : aucune cible, Menu jamais pris. */
export const MIGRATION_SCREEN_FOCUS = {
  focusable: false,
  takesBack: false,
} as const;

export function decideMigrationScreen(input: MigrationScreenInput): MigrationScreenDecision {
  const show = input.migrating && !input.playbackShown;
  return { show, hideScreens: show, offlineVeilAllowed: !input.migrating, exitOnBack: show };
}
