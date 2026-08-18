import { idealCardWidth } from "@/components/cards/cardSizes";
import type { cardWidthStyle as OriginalCardWidthStyle } from "@/components/cards/cardWidthStyle";

/**
 * La largeur en ligne d'une carte, sans `clamp()`.
 *
 * Substitué à `cardWidthStyle`. **Chrome 53 ne connaît pas `clamp()`**, et un
 * moteur qui ne reconnaît pas une fonction ne se contente pas d'ignorer la
 * valeur : il jette la DÉCLARATION. La carte se retrouve en `width: auto`,
 * c'est-à-dire à sa largeur `max-content` — dictée par la longueur de son
 * titre. Mesuré sur l'émulateur webOS 4.0 : des cartes de 66 px à côté de
 * cartes de 259 px sur la même rangée, et comme la hauteur d'une affiche vaut
 * 150 % de sa largeur, des hauteurs toutes différentes avec elles.
 *
 * Le repli calcule donc EN JAVASCRIPT ce que le `clamp` aurait donné —
 * `idealCardWidth` est la fonction que `useRowCardWidth` emploie déjà pour son
 * point de départ, donc la même arithmétique — et l'écrit en pixels. Arrondi
 * à l'entier : une abscisse fractionnaire suffit à ramollir le texte qu'elle
 * porte.
 *
 * Le repli ne sert qu'aux instants où la rangée n'a pas encore pu se caler.
 * S'il devient permanent, le défaut est ailleurs — c'était le cas tant que
 * `TrackTv` était monté derrière la porte d'entrée en vue.
 *
 * Le type est IMPORTÉ de l'original plutôt que réécrit : `tsc` ne connaît pas
 * les substitutions, et un remplaçant qui recopie une signature à la main est
 * libre d'en diverger en silence.
 */
export const cardWidthStyle: typeof OriginalCardWidthStyle = (width, widths, vw) => {
  if (width != null) return `${width}px`;
  const largeur = idealCardWidth(widths, vw, window.innerWidth);
  return `${Math.floor(largeur)}px`;
};
