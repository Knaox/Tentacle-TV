/**
 * La PAGE d'un compte bloqué (désactivé, hors plage — docs/DROITS-UTILISATEURS.md
 * § 9.1), sur les téléviseurs — la décision, pure. Le CE QUI s'affiche (l'état,
 * la capacité du serveur) est la règle commune de tous les clients (api-client
 * `useAccountAccess`, shared `accountAccessView`) ; ici, le COMMENT sur une TV :
 *
 * - la page REMPLACE les écrans de l'application, qui restent montés pour React
 *   mais sans vue native (le rideau de la migration) : rien d'en dessous ne se
 *   dessine ni ne prend le focus, et la pile revient intacte à la réouverture ;
 * - elle ne CÈDE PAS au lecteur, au contraire de la migration : la lecture est
 *   COUPÉE tout de suite (décision de Damien, 2026-10-15) — l'écran de lecture
 *   au premier plan se ferme ;
 * - le focus ENTRE sur l'action principale et n'en sort par aucun côté ;
 * - Retour / Menu ne la contournent pas : jamais pris, l'application quitte
 *   vers l'accueil du système (Apple TV), ou quitte (Android TV, `exitOnBack`) ;
 * - l'action principale : « Changer de profil » pour une session de profil de
 *   la Famille, « Se déconnecter du serveur » (déjumelage, à double appui)
 *   sinon ;
 * - ce n'est jamais une panne : tant qu'elle est là, pas de voile hors ligne.
 */

export interface AccountAccessScreenInput {
  /** La porte commune rend un état bloqué. */
  blocked: boolean;
  /** La TV est dans une session de profil de la Famille. */
  profileSession: boolean;
  /** Un écran de lecture (lecteur, bande-annonce) est au premier plan. */
  playbackShown: boolean;
}

export type AccountAccessScreenAction = "switchProfile" | "unpair";

export interface AccountAccessScreenDecision {
  show: boolean;
  /** Les écrans de l'application passent sans vue native. */
  hideScreens: boolean;
  /** L'écran de lecture au premier plan se ferme : la lecture est coupée. */
  stopPlayback: boolean;
  /** Le voile hors ligne a le droit de paraître. */
  offlineVeilAllowed: boolean;
  /** Android TV : Retour quitte l'application au lieu d'agir sur l'écran caché. */
  exitOnBack: boolean;
  /** L'action principale, où le focus entre. */
  action: AccountAccessScreenAction;
}

/** Les clés de focus de la page : son groupe (le piège) et son action, l'entrée. */
export const ACCOUNT_ACCESS_SCREEN = {
  group: "access:panel",
  action: "access:action",
} as const;

export const ACCOUNT_ACCESS_SCREEN_KEYS: readonly string[] = [ACCOUNT_ACCESS_SCREEN.action];

/** Ce que décide la page : son entrée, un piège des quatre côtés, Menu jamais pris. */
export const ACCOUNT_ACCESS_SCREEN_FOCUS = {
  entry: ACCOUNT_ACCESS_SCREEN.action,
  trapped: true,
  takesBack: false,
} as const;

export function decideAccountAccessScreen(input: AccountAccessScreenInput): AccountAccessScreenDecision {
  const show = input.blocked;
  return {
    show,
    hideScreens: show,
    stopPlayback: show && input.playbackShown,
    offlineVeilAllowed: !show,
    exitOnBack: show,
    action: input.profileSession ? "switchProfile" : "unpair",
  };
}
