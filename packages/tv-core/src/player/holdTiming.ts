/**
 * Les RYTHMES du moteur de maintien (`holdMotor.ts`) : le tic, les paliers, le
 * silence qui vaut relâchement, ce qui sépare un geste d'une répétition. Sortis
 * du moteur pour son budget de lignes ; il les réexporte à leur adresse
 * d'avant.
 */

/** La cadence du tic. Celle d'`apps/tv`, et elle ne dépend de rien. */
export const HOLD_TICK_MS = 250;

/** Un palier par seconde de maintien — 1×, 2×, 4×, 8×. */
export const MS_PER_TIER = 1000;

/** Le silence tant qu'on n'a pas mesuré la dalle. Valeur du reste du portage. */
export const SILENCE_DEFAULT_MS = 700;

/** Le plancher, repris d'`apps/tv` : en deçà, une répétition normale ferait rupture. */
export const SILENCE_MIN_MS = 350;

/** De combien d'intervalles un silence doit dépasser pour valoir relâchement. */
export const SILENCE_FACTOR = 2.5;

/** Sous cette valeur, l'intervalle mesuré relève du rebond, pas de la répétition. */
export const MIN_INTERVAL_MS = 60;

/**
 * Au-delà de cet écart, deux appuis sont deux GESTES, pas une répétition.
 *
 * Le seuil de silence (350–700 ms) dit quand un maintien s'ARRÊTE ; il ne dit
 * pas ce qui l'a commencé, et il servait pourtant aux deux. Or on tape
 * volontiers deux fois sur la même flèche en trois cents millisecondes : le
 * second appui tombait sous le seuil, passait pour une auto-répétition, et
 * lançait le tic. Deux sauts demandés, une avance rapide obtenue.
 */
export const REPEAT_INTERVAL_MS = 450;

/**
 * Combien de répétitions consécutives avant que le tic prenne la main.
 *
 * Le seul plafond ne suffisait pas : une dalle dont l'auto-répétition tourne à
 * quatre cents millisecondes — le module rappelle plus haut que cette cadence
 * n'est ni documentée ni constante d'un modèle à l'autre — ne l'aurait jamais
 * franchi, et l'avance rapide y aurait purement disparu. Ce qui distingue
 * vraiment une dalle d'un doigt n'est pas la vitesse, c'est l'INSISTANCE.
 *
 * Deux répétitions suffisent : un doigt qui tape deux fois produit un seul
 * enchaînement et garde ses deux sauts, une touche tenue en produit autant
 * qu'on veut. Taper trois fois de suite déclenchera l'avance rapide — c'est
 * assumé : à ce stade, c'est bien ce qu'on demande.
 */
export const REPEATS_BEFORE_TICK = 2;

/**
 * En dessous de cet écart, aucun doigt ne peut être en cause : c'est la dalle.
 *
 * Le compteur de répétitions protège des doigts insistants, mais il coûte des
 * sauts : chaque battement avant l'engagement en produit un, et sur une touche
 * réellement tenue on n'en veut aucun de trop avant que le curseur fantôme
 * parte. Une auto-répétition rapide se reconnaît sans hésitation possible, et
 * l'on engage alors dès le premier battement.
 *
 * Une télécommande a de la course : deux appuis séparés par moins de deux
 * cents millisecondes ne s'obtiennent pas au doigt, et la dalle émettrait de
 * toute façon un `keyup` entre les deux — qui remet le compteur à zéro.
 */
export const AUTO_REPEAT_MS = 200;

/**
 * Le plafond d'un maintien ANNONCÉ (`hold`) : sa fin vient de `release`, et
 * ce n'est qu'un filet si elle se perdait. Au palier maximal, un long métrage
 * se traverse en deux secondes : trente secondes de maintien ne sont pas un
 * geste.
 */
export const HOLD_ANNOUNCED_MAX_MS = 30_000;
