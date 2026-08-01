/**
 * Où en est la lecture d'un fichier local, et à partir de quand il est « vu ».
 *
 * # Le seuil n'est pas à nous
 *
 * C'est `MaxResumePct` de Jellyfin — la même valeur qui fait apparaître la
 * bannière « épisode suivant », et celle sur laquelle le serveur décide qu'une
 * vidéo est terminée. La coder en dur ferait diverger l'hors-ligne de l'en-ligne
 * dès qu'un administrateur change le réglage : un épisode marqué vu sur le web
 * et pas sur le bureau, ou l'inverse.
 *
 * Chemin de la valeur : `/System/Configuration` de Jellyfin → backend →
 * `/api/config/autoplay` → `useAutoplayConfigLocalFirst`, qui la photographie
 * pour l'hors-ligne. Le repli ci-dessous ne sert que si le serveur n'a jamais
 * répondu sur cette machine.
 *
 * # Pourquoi le seuil est borné ici
 *
 * La photo vit dans `localStorage` : elle peut avoir été bricolée, ou écrite par
 * une version antérieure. Un seuil à 0 marquerait tout « vu » à la première
 * seconde, et supprimerait dans la foulée les téléchargements réglés sur
 * « effacer après visionnage ». On borne donc au point de décision, une fois.
 */

import { TICKS_PER_SECOND } from "@tentacle-tv/shared";

/** Repli quand le serveur n'a jamais répondu — la valeur par défaut de Jellyfin. */
export const SEUIL_VU_PAR_DEFAUT = 90;

export interface EtatLectureLocale {
  /** Position en ticks Jellyfin, jamais négative. */
  ticks: number;
  played: boolean;
}

/** Seuil retenu : celui du serveur s'il est exploitable, le repli sinon. */
export function seuilVu(pct: number | undefined): number {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return SEUIL_VU_PAR_DEFAUT;
  if (pct <= 0 || pct > 100) return SEUIL_VU_PAR_DEFAUT;
  return pct;
}

/**
 * Position et état « vu » à cet instant.
 *
 * Durée inconnue (mpv ne l'a pas encore, fichier sans en-tête exploitable) : on
 * ne conclut rien. Marquer vu sur une durée de zéro effacerait un
 * téléchargement que personne n'a regardé.
 */
export function etatLectureLocale(
  seconds: number,
  durationSeconds: number,
  seuilPct: number,
): EtatLectureLocale {
  const ticks = Math.max(0, Math.floor(seconds * TICKS_PER_SECOND));
  if (!(durationSeconds > 0)) return { ticks, played: false };
  const pct = (seconds / durationSeconds) * 100;
  return { ticks, played: pct >= seuilVu(seuilPct) };
}
