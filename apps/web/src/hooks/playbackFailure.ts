/**
 * Classement d'un échec de lecture mpv : erreur de MÉDIA ou erreur de LECTEUR.
 *
 * L'enjeu est la bascule de secours, mémorisée pour toute la session
 * (`lib/lecteurSecours.ts`) : condamner mpv parce qu'UN fichier a disparu du
 * disque prive tous les médias suivants du lecteur natif — c'est le bug du
 * 27.08. À l'inverse, ne PAS basculer sur un vrai défaut de lecteur (décodeur
 * absent, chaîne incomplète) laisserait l'utilisateur sans image.
 *
 * # Pourquoi le code d'erreur mpv ne décide pas
 *
 * Mesuré : `MPV_ERROR.LOADING_FAILED` (−13) sort autant pour un fichier local
 * disparu (média) que pour un protocole absent de la chaîne (lecteur). Le seul
 * discriminant fiable est la VÉRIFICATION D'EXISTENCE du fichier, et elle n'a
 * de sens qu'en lecture locale. D'où la règle, volontairement étroite :
 *
 * - MÉDIA : lecture locale ET sonde formelle « le fichier n'est plus là ».
 * - LECTEUR : tout le reste — réseau, fichier présent mais illisible, sonde
 *   muette. Dans le doute, la bascule reste le comportement sûr : elle rend
 *   une lecture qui marche (repli web §3.9), jamais un écran mort.
 */

export type PlaybackFailureKind = "media" | "player";

export interface PlaybackFailure {
  kind: PlaybackFailureKind;
  /** Clé i18n complète (« player:… ») quand le message est des nôtres. */
  messageKey?: string;
  /** Détail brut (mpv, init) — injecté dans `player:mpvError` en dernier recours. */
  detail?: string;
}

/**
 * Classe un `end-file(reason=ERROR)`.
 *
 * `localFilePresent` est le verdict de la sonde d'existence (re-résolution
 * `downloads_local_source` APRÈS l'échec) : `null` = sonde impossible (IPC en
 * échec, lecture réseau) — jamais « média » sans preuve.
 */
export function classifyEndFileFailure(input: {
  errorCode: number | undefined;
  isLocalPlayback: boolean;
  localFilePresent: boolean | null;
}): PlaybackFailure {
  if (input.isLocalPlayback && input.localFilePresent === false) {
    return { kind: "media" };
  }
  return {
    kind: "player",
    detail: `end-file (error=${input.errorCode ?? "?"})`,
  };
}
