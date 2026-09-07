/**
 * Classement d'un échec de lecture mpv : erreur de MÉDIA ou erreur de LECTEUR.
 *
 * L'enjeu est la bascule de secours, mémorisée pour toute la session
 * (`lib/fallbackPlayer.ts`) : condamner mpv parce qu'UN fichier a disparu du
 * disque prive tous les médias suivants du lecteur natif — c'est le bug du
 * 27.08. À l'inverse, ne PAS basculer sur un vrai défaut de lecteur (décodeur
 * absent, chaîne incomplète) laisserait l'utilisateur sans image.
 *
 * Mesuré : `MPV_ERROR.LOADING_FAILED` (−13) sort autant pour un fichier local
 * disparu (média) que pour un protocole absent de la chaîne (lecteur). La règle
 * — « média » seulement sur une sonde formelle d'absence — vit dans le cœur
 * hors ligne, commune au mobile ; ici ne reste que le détail mpv.
 */

import { classifyLocalPlaybackFailure, type PlaybackFailure } from "@tentacle-tv/offline-core";

export type { PlaybackFailure, PlaybackFailureKind } from "@tentacle-tv/offline-core";

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
  return classifyLocalPlaybackFailure({
    isLocalPlayback: input.isLocalPlayback,
    localFilePresent: input.localFilePresent,
    detail: `end-file (error=${input.errorCode ?? "?"})`,
  });
}
