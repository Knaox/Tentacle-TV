/** Les mesures de la grille Bibliothèque — sorties de `LibraryGrid` (limite de 300 lignes), inchangées. */

export const POSTER_ASPECT = 2 / 3;
/**
 * Hauteur du bloc de légende, en pixels — une PREMIÈRE approximation, plus une
 * vérité.
 *
 * Elle a longtemps été la seule chose que le virtualiseur connaissait de la
 * hauteur d'une rangée, et elle est calée sur la typographie du navigateur.
 * Toute typographie plus grande la dément : un plancher de taille de police —
 * ce que pose la cible téléviseur, où l'on lit à trois mètres —, un zoom, une
 * préférence système, ou simplement un titre qui passe sur deux lignes dans une
 * autre langue.
 *
 * Mesuré sur la dalle avant correctif : légende de 80 px contre 52 annoncés,
 * donc un pas de rangée de 342 px pour des cartes de 353. Les rangées étant
 * positionnées en absolu, elles ne se contentaient pas de se serrer : elles se
 * RECOUVRAIENT de onze pixels, les affiches d'une ligne mordant sur le titre de
 * la précédente. C'est le « manque d'espacement » signalé.
 *
 * Le virtualiseur mesure désormais les rangées qu'il a montées
 * (`measureElement`), et cette constante ne sert plus qu'à réserver la place
 * avant la première mesure.
 */
export const TEXT_HEIGHT = 52;
export const GAP = 16;
