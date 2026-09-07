/**
 * Classement d'un échec de lecture LOCALE : erreur de MÉDIA ou erreur de
 * LECTEUR.
 *
 * Le seul discriminant fiable est la VÉRIFICATION D'EXISTENCE du fichier
 * après l'échec — un code d'erreur du lecteur natif, quel qu'il soit, sort
 * autant pour un fichier disparu que pour un décodeur absent. D'où la règle,
 * volontairement étroite : « média » seulement en lecture locale ET sur une
 * sonde formelle « le fichier n'est plus là » ; « lecteur » pour tout le
 * reste, sonde muette comprise. Dans le doute, le repli du lecteur reste le
 * comportement sûr.
 */

export type PlaybackFailureKind = "media" | "player";

export interface PlaybackFailure {
  kind: PlaybackFailureKind;
  /** Clé i18n complète (« player:… ») quand le message est des nôtres. */
  messageKey?: string;
  /** Détail brut du lecteur — injecté dans un message générique en dernier recours. */
  detail?: string;
}

export function classifyLocalPlaybackFailure(input: {
  isLocalPlayback: boolean;
  /** Verdict de la sonde d'existence ; `null` = sonde impossible — jamais « média » sans preuve. */
  localFilePresent: boolean | null;
  detail?: string;
}): PlaybackFailure {
  if (input.isLocalPlayback && input.localFilePresent === false) return { kind: "media" };
  return input.detail === undefined ? { kind: "player" } : { kind: "player", detail: input.detail };
}
