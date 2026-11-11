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
import { mpvFailure, type PlaybackFailure as SharedPlaybackFailure } from "@tentacle-tv/shared";

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

/** `mpv_error_string` des codes que rend une fin de fichier en erreur. */
const MPV_ERROR_STRINGS: Record<number, string> = {
  [-13]: "loading failed",
  [-16]: "nothing to play",
  [-17]: "unrecognized file format",
  [-18]: "unsupported",
};

/**
 * mpv ne s'est pas INITIALISÉ — `mpv_init` refusé, ou resté sans réponse huit
 * secondes (`useMpvLifecycle`). Un défaut du LECTEUR, par nature : son détail
 * le dit, pour que le signalement ne le prenne jamais pour une affaire de
 * serveur (son message contient « timeout »).
 */
const MPV_INIT_DETAIL = "mpv-init";

export function mpvInitFailure(error: unknown): PlaybackFailure {
  return { kind: "player", detail: `${MPV_INIT_DETAIL} (${String(error)})` };
}

/**
 * Les `mpv_error` qui accusent le lecteur LUI-MÊME, jamais le flux ni le
 * fichier (`client.h` de mpv) : mémoire (−2), cœur non initialisé (−3),
 * sorties audio (−14) et vidéo (−15) impossibles, erreur générique (−20).
 */
const MPV_ENGINE_ERRORS: ReadonlySet<number> = new Set([-2, -3, -14, -15, -20]);

/**
 * L'échec du lecteur de bureau, dans la forme commune : le chien de garde
 * (« le flux n'a pas démarré ») est une attente dépassée, une fin de fichier
 * en erreur un message de mpv — la sonde du flux dira ensuite si c'est le
 * réseau, le serveur, le fichier ou le lecteur.
 *
 * Deux échecs n'attendent AUCUNE sonde — le moteur lui-même est en cause, et
 * le lecteur web prend le relais (`isPlayerFault`) : une initialisation ratée,
 * et une fin de fichier dont le code accuse mpv. Mesuré le 11/11/2026 : classés
 * par le texte et les sondes, un `mpv-init-timeout` devenait « le serveur met
 * trop de temps à répondre », et une chute de mpv « connexion perdue » dès que
 * la sonde du flux n'aboutissait pas — sans jamais basculer.
 */
export function desktopPlaybackReport(failure: PlaybackFailure): SharedPlaybackFailure {
  if (failure.messageKey === "player:streamStartFailed") return { from: "marker", marker: "startTimeout" };
  // Un saut pendant un transcodage qui n'a rien ramené (`useSeekWaitFeedback`).
  if (failure.messageKey === "errors:reasonSeekTimeout") return { from: "marker", marker: "seekTimeout" };
  if (failure.detail?.startsWith(MPV_INIT_DETAIL)) return { from: "marker", marker: "engineFailed" };
  const code = /error=(-?\d+)/.exec(failure.detail ?? "")?.[1];
  if (code !== undefined && MPV_ENGINE_ERRORS.has(Number(code))) return { from: "marker", marker: "engineFailed" };
  const text = code !== undefined ? MPV_ERROR_STRINGS[Number(code)] ?? `mpv error ${code}` : failure.detail ?? "";
  return { from: "engine", failure: { ...mpvFailure(text), code: code ?? undefined } };
}
