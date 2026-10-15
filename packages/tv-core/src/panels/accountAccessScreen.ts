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
 * - les actions : « Changer de profil » pour une session de profil de la
 *   Famille — sauf la session « solo » (le compte seul, ouvert d'office), où
 *   « Qui regarde ? » ne rendrait que ce même profil bloqué —, puis « Se
 *   déconnecter du serveur » (déjumelage, à double appui) pour qui peut
 *   déjumeler la TV (le compte qui l'a jumelée, ou une TV d'avant les profils).
 *   La première est l'action principale, où le focus entre ;
 * - ce n'est jamais une panne : tant qu'elle est là, pas de voile hors ligne.
 */

export interface AccountAccessScreenInput {
  /** La porte commune rend un état bloqué. */
  blocked: boolean;
  /** La TV est dans une session de profil de la Famille. */
  profileSession: boolean;
  /** Cette session est celle du compte seul, ouverte d'office (`launch: "solo"`). */
  soloProfile: boolean;
  /** Le profil ouvert est celui du compte qui a jumelé la TV (lui seul la déjumelle). */
  pairedTheTv: boolean;
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
  /** Les actions, la principale d'abord (le focus y entre). */
  actions: AccountAccessScreenAction[];
}

/** Les clés de focus de la page : son groupe (le piège) et une par action. */
export const ACCOUNT_ACCESS_SCREEN = {
  group: "access:panel",
  switchProfile: "access:switchProfile",
  unpair: "access:unpair",
} as const;

export const ACCOUNT_ACCESS_SCREEN_KEYS: readonly string[] = [ACCOUNT_ACCESS_SCREEN.switchProfile, ACCOUNT_ACCESS_SCREEN.unpair];

/** Ce que décide la page : un piège des quatre côtés, Menu jamais pris ; l'entrée, `accountAccessEntry`. */
export const ACCOUNT_ACCESS_SCREEN_FOCUS = {
  trapped: true,
  takesBack: false,
} as const;

/** La clé où le focus entre : l'action principale. */
export function accountAccessEntry(actions: readonly AccountAccessScreenAction[]): string {
  return ACCOUNT_ACCESS_SCREEN[actions[0] ?? "unpair"];
}

export function decideAccountAccessScreen(input: AccountAccessScreenInput): AccountAccessScreenDecision {
  const show = input.blocked;
  return {
    show,
    hideScreens: show,
    stopPlayback: show && input.playbackShown,
    offlineVeilAllowed: !show,
    exitOnBack: show,
    actions: accountAccessActions(input),
  };
}

function accountAccessActions(input: AccountAccessScreenInput): AccountAccessScreenAction[] {
  if (!input.profileSession) return ["unpair"];
  if (input.soloProfile) return input.pairedTheTv ? ["unpair"] : ["switchProfile"];
  return input.pairedTheTv ? ["switchProfile", "unpair"] : ["switchProfile"];
}
