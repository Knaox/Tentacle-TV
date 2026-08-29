/**
 * Quelle part du film est déjà chargée ?
 *
 * # Le décalage qu'on oubliait
 *
 * Les flux transcodés portent `CopyTimestamps` : leurs horodatages gardent la
 * base du conteneur d'origine, qui n'est pas toujours zéro. Le dépôt en a un
 * exemple mesuré — un enregistrement de diffusion dont tout commence à 677
 * secondes. La position AFFICHÉE retranche ce décalage ; le tampon, lui, était
 * lu brut. La couche de préchargement devançait donc la progression de
 * `décalage / durée` en permanence, soit près de dix pour cent d'un film de deux
 * heures, dès la première seconde et sans jamais se corriger.
 *
 * # Ce que `buffered` vaut selon le lecteur
 *
 * Sur un navigateur, `buffered` rend de vraies plages : celle qui contient la
 * position dit ce qu'on a devant soi, les autres sont des restes d'un saut
 * précédent. C'est pourquoi on cherche la plage courante avant de se rabattre
 * sur la plus avancée.
 *
 * Sur la pile média du téléviseur, il n'y a jamais qu'UNE plage, et elle part
 * toujours de zéro — mesuré : `bufferDebut` valait 0 sur 13 678 des 13 731
 * relevés du dépôt, `null` sur les 53 autres, jamais rien d'autre. La recherche
 * dégénère alors et rend la borne haute, c'est-à-dire tout ce dont on dispose.
 * Ce n'est pas exact, c'est simplement la seule information que cette pile
 * accepte de donner.
 *
 * Ce module ne dépend pas du DOM : `TimeRanges` n'est pas instanciable, et le
 * dépôt ne monte jamais de lecteur pour ses tests.
 */

/** Une plage de `TimeRanges`, réduite à ce qu'on en lit. */
export interface BufferRange {
  start: number;
  end: number;
}

/**
 * De combien la position peut déborder d'une plage sans qu'on la juge dehors.
 *
 * Une demi-seconde : la position et les bornes du tampon ne sont pas relevées au
 * même instant, et un écart de quelques images ferait sauter la plage courante
 * au profit d'un reste de saut précédent.
 */
export const RANGE_TOLERANCE_S = 0.5;

/**
 * Fraction du film déjà chargée, de 0 à 1 — ou `null` quand la question n'a pas
 * de réponse, auquel cas l'appelant ne doit rien changer à l'affichage.
 *
 * `duration` est la durée du FILM, `offset` la base d'horodatage du conteneur :
 * les deux ramènent le tampon dans le même temps que la position affichée.
 */
export function bufferedFraction(
  ranges: BufferRange[],
  position: number,
  duration: number,
  offset: number,
): number | null {
  if (!Number.isFinite(duration) || duration <= 0 || ranges.length === 0) return null;

  const current = ranges.find(
    (p) => position >= p.start - RANGE_TOLERANCE_S && position <= p.end + RANGE_TOLERANCE_S,
  );
  const end = (current ?? ranges[ranges.length - 1]).end;

  // Le décalage se retranche ICI, comme il l'est de la position affichée. Sans
  // cela, les deux couches de la barre ne racontent pas le même film.
  const bufferedUntil = end - offset;
  if (!Number.isFinite(bufferedUntil)) return null;

  return Math.min(1, Math.max(0, bufferedUntil / duration));
}
