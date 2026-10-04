/**
 * Les DÉLAIS de l'entrée dans un profil (« Qui regarde ? », Apple TV) — pas
 * des transitions : celles-ci sont des jetons de mouvement (`TV_MOTION.profile`,
 * une demi-seconde au plus chacun). Ici, ce qu'on ATTEND avant de dire qu'on
 * attend. Module pur.
 */

/** « Ouverture de Léa… » ne paraît que si le serveur tarde au-delà : sinon, l'entrée suffit. */
export const OPENING_HINT_DELAY_MS = 500;

/**
 * L'accueil arrivé par le fondu (`Home` + `entrance`) ne dit « Chargement… »
 * qu'après ce délai : le fondu en tient lieu, puis sa première lecture,
 * d'ordinaire plus courte — sans panneau posé en surimpression du profil qui
 * s'efface (relevé image par image : accueil chargé ~600 ms après le fondu).
 * Au-delà, le panneau revient : jamais un écran vide qui dure.
 */
export const HOME_ARRIVAL_QUIET_MS = 900;
