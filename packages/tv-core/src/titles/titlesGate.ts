import type { TitleProvider, TitlesAccess } from "@tentacle-tv/shared";

/**
 * Les fonctions d'une extension de demandes sur les téléviseurs — « Demander »,
 * la recherche hors bibliothèque, les demandes en cours : TOUT ou RIEN, selon
 * ce que le serveur déclare (contrat `titles`, `@tentacle-tv/shared`) :
 *
 *   1. une extension active et configurée déclare `titles` ;
 *   2. elle déclare aussi le droit du compte (`titles.access`) ;
 *   3. et ce droit est ouvert (`request: true`).
 *
 * Sans l'une des trois — serveur ou extension d'avant ce contrat, compte
 * bloqué dans l'extension (le compte de démonstration de la revue Apple) —,
 * aucune trace de l'extension sur la TV. Un droit pas encore lu, ou
 * illisible, ferme aussi : rien ne paraît avant d'être permis.
 */
export function titlesFeaturesOpen(provider: TitleProvider | null, access: TitlesAccess | null | undefined): boolean {
  return provider !== null && provider.accessPath !== null && access?.request === true;
}

/**
 * Ce que coûte le suivi des demandes en cours : relues souvent pendant qu'on
 * les regarde, rarement sinon — et au retour au premier plan, si la dernière
 * lecture date (`staleMs`). Le droit du compte change rarement : relu au même
 * rythme que la liste des extensions actives.
 */
export const MY_TITLES_REFRESH = {
  /**
   * Le DIRECT : un titre avance (en route, ou en train d'entrer dans la
   * bibliothèque) et on le voit — la fenêtre, l'aperçu du rail, des cartes à
   * l'écran —, l'app au premier plan. Le rythme de Vigie sur le téléphone et
   * le bureau : sa file se relit toutes les 8 s, sa liste se garde 10 s
   * (`liveProgress.ts` fait avancer l'écran entre deux lectures).
   */
  liveMs: 10_000,
  /** La liste ouverte : l'avancement bouge à vue. */
  watchingMs: 30_000,
  /** Le rail seul : la pile d'aperçu, rafraîchie de loin en loin. */
  idleMs: 5 * 60_000,
  /** Au retour au premier plan : relire si la dernière lecture a plus que ça. */
  staleMs: 60_000,
  /** La liste des extensions actives et le droit du compte. */
  accessMs: 10 * 60_000,
} as const;

/** L'intervalle de relecture des titres attendus, selon qu'on les regarde ou non. */
export function myTitlesRefetchMs(watching: boolean): number {
  return watching ? MY_TITLES_REFRESH.watchingMs : MY_TITLES_REFRESH.idleMs;
}
