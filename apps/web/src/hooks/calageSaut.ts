/**
 * Un saut a-t-il abouti, ou faut-il redemander une session au serveur ?
 *
 * # Ce que la veille précédente croyait mesurer
 *
 * Le filet de `useSmartSeek` armait un minuteur qui comparait, huit secondes
 * après le saut, `currentTime` à la cible :
 *
 *     if (Math.abs(el.currentTime - ptsTarget) > 2) { renégocier }
 *
 * Or c'est la ligne juste au-dessus qui venait d'écrire `v.currentTime =
 * ptsTarget`, et cette écriture est SYNCHRONE : la propriété vaut la cible
 * immédiatement, que le moindre octet soit arrivé ou non. La condition était donc
 * fausse même quand rien ne se lisait, et le niveau 3 — tuer l'encodage puis
 * renégocier à la position voulue — n'était jamais atteint.
 *
 * Deux autres mains désarmaient ce qu'il en restait : `seeked` et `playing`
 * annulaient le minuteur (cf. `useVideoEvents`), et tous deux sont émis bien avant
 * que les données de la cible soient là.
 *
 * # Le témoin honnête
 *
 * `v.buffered` couvre-t-il la cible ? Des données démultiplexées à cet endroit
 * sont la seule preuve que le déplacement a abouti — le lecteur ne peut pas les
 * fabriquer. À défaut, une position franchement AU-DELÀ de la cible prouve que la
 * lecture a repris toute seule.
 *
 * # Ce que ce module ne juge pas
 *
 * Il répond « le déplacement a-t-il abouti », pas « la lecture avance-t-elle ».
 * Un film qui se fige APRÈS un saut réussi relève de la veille de gel
 * (`relanceGel.ts`, côté téléviseur), qui surveille la progression. La frontière
 * compte : sur la dalle, on a mesuré un gel avec `readyState 4` et un tampon de
 * dix-neuf secondes d'avance — le saut, lui, avait parfaitement abouti.
 */

/** Ce qu'on observe d'un saut en cours, sans dépendre du DOM pour les tests. */
export interface EchantillonSaut {
  /** La cible du saut, en temps PTS de l'élément vidéo. */
  cible: number;
  /** `v.buffered` couvre-t-il la cible ? */
  couverte: boolean;
  /** `v.currentTime` au relevé. */
  position: number;
  /** `v.paused` — une pause voulue n'est pas un calage. */
  enPause: boolean;
  /**
   * Millisecondes depuis l'armement de la veille. Le module reste pur : c'est
   * l'appelant qui lit l'horloge, et les tests la fabriquent.
   */
  ecoule: number;
}

export type VerdictSaut = "attendre" | "abouti" | "renegocier";

/**
 * Au bout de combien de temps un saut HLS est considéré comme calé.
 *
 * Huit secondes, et non trois comme l'annonçaient les commentaires : la valeur
 * est là depuis toujours, seule sa documentation était fausse. Descendre
 * échangerait de l'attente contre un redémarrage de transcodage de trois à cinq
 * secondes — qui n'était pas nécessaire.
 */
export const DELAI_CALAGE_SAUT_MS = 8000;

/**
 * À quelle cadence relever.
 *
 * Un minuteur unique ne pouvait conclure qu'une fois ; une veille périodique
 * s'arrête d'elle-même dès que la cible est chargée, ce qui est le cas courant et
 * ne coûte alors qu'un ou deux relevés.
 */
export const PERIODE_VEILLE_SAUT_MS = 1000;

/**
 * De combien la position doit dépasser la cible pour prouver la reprise.
 *
 * `currentTime` vaut la cible dès l'écriture ; seul un franchissement net dit que
 * des images sont sorties. Une demi-seconde est au-dessus de la gigue de rendu et
 * en dessous de la durée du plus court segment observé.
 */
export const AVANCE_PROUVEE_S = 0.5;

/**
 * Un relevé de plus, et ce qu'il faut en faire.
 *
 * L'ordre des règles est le fond de l'affaire : l'aboutissement se constate AVANT
 * tout compte à rebours, sinon un saut réussi en une seconde resterait « en
 * attente » pendant les sept suivantes.
 */
export function jugerSaut(e: EchantillonSaut): VerdictSaut {
  if (e.couverte || e.position > e.cible + AVANCE_PROUVEE_S) return "abouti";

  // En pause voulue, rien ne doit avancer — et renégocier ferait repartir la
  // lecture sous les doigts de l'utilisateur. On ne conclut pas, on attend qu'il
  // reprenne : le jugement continuera alors.
  if (e.enPause) return "attendre";

  if (e.ecoule < DELAI_CALAGE_SAUT_MS) return "attendre";
  return "renegocier";
}
