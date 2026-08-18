/**
 * Reconnaître une lecture figée — et se contenter de le dire.
 *
 * # Pourquoi ce module ne répare plus rien
 *
 * Il a longtemps rechargé la source (`load()` puis repositionnement), et cela
 * paraissait justifié : mesuré une fois, le remède avait relancé la lecture en
 * 2,4 secondes. Le journal du proxy a montré que le diagnostic était faux.
 *
 * Pendant un gel, le serveur va parfaitement bien : il répond **200 en 12 ms**,
 * les segments sont écrits sur son disque, ffmpeg a des minutes d'avance. Ce
 * qu'on voit, c'est le téléviseur qui ouvre et abandonne **deux segments
 * adjacents** une trentaine de fois par seconde, chaque tentative lâchée après
 * 12 à 57 ms — quelques centaines de kilo-octets sur un segment de 9,6 Mo. Il ne
 * tente pas de les télécharger : il les rejette presque aussitôt. La lecture
 * continue pendant ce temps, mais l'avance du tampon fond de 45 à 10 secondes,
 * et quand elle atteint zéro l'image se fige. Puis elle repart seule, l'obstacle
 * franchi.
 *
 * Recharger là-dedans ne répare rien et coûte cher : `load()` jette un tampon qui
 * contenait encore dix secondes d'avance, redemande 1,7 Mo de playlist, puis le
 * segment d'initialisation et le segment 0 — ce qui fait relancer à Jellyfin un
 * ffmpeg au tout début du film. Le remède coûtait plus que le mal.
 *
 * La session n'est pas morte. Il n'y a rien à relancer.
 *
 * # Ce qu'il reste, et pourquoi c'est utile
 *
 * La détection, qui devient un instrument : elle date les gels, mesure leur
 * durée et l'avance du tampon au moment où ils surviennent. C'est ce que
 * l'enquête sur la pile média de LG a besoin de lire, et cela ne coûte qu'une
 * ligne de journal.
 *
 * # Pourquoi ne pas se fier au taux d'images
 *
 * `videooutput/getStatus` rend bien un `frameRate`, mais il vaut 23,976 pendant
 * le gel comme pendant la lecture : c'est la cadence NOMINALE du flux, pas le
 * rendu réel. Le seul témoin fiable est la position qui n'avance plus.
 */

/** Ce qu'on observe d'un élément vidéo, sans dépendre du DOM pour les tests. */
export interface EchantillonLecture {
  position: number;
  enPause: boolean;
  /** `HTMLMediaElement.readyState` — 4 = HAVE_ENOUGH_DATA. */
  pret: number;
  /** `HTMLMediaElement.error?.code`, `null` s'il n'y en a pas. */
  erreur: number | null;
  /**
   * `Date.now()` au moment du relevé. Le module reste pur : c'est l'appelant
   * qui lit l'horloge, et les tests la fabriquent.
   */
  instant?: number;
}

/** Erreur réseau : le flux est bon, c'est la liaison qui a manqué. */
export const MEDIA_ERR_NETWORK = 2;

/**
 * Combien de relevés immobiles avant de conclure.
 *
 * Trois à deux secondes d'intervalle, soit quatre secondes de position figée.
 * En dessous, une saccade de décodage suffirait à crier au gel.
 */
export const RELEVES_AVANT_GEL = 3;

/**
 * De combien la position doit avancer entre deux relevés pour compter.
 *
 * `currentTime` ne progresse pas au millième près : en dessous d'un quart de
 * seconde en quatre secondes, il ne se passe rien de bon.
 */
export const TOLERANCE_PROGRESSION_S = 0.25;

export interface EtatVeille {
  /** Position du dernier relevé, `null` avant le premier. */
  derniere: number | null;
  /** Relevés consécutifs sans progression. */
  immobiles: number;
  /** Instant du gel en cours, `null` si la lecture avance. */
  fige: number | null;
}

export const VEILLE_VIDE: EtatVeille = { derniere: null, immobiles: 0, fige: null };

/**
 * - `"fige"` — la position ne bouge plus. Dit UNE fois par gel.
 * - `"reprise"` — elle est repartie, et l'appelant peut dire combien ça a duré.
 */
export type Verdict = "rien" | "fige" | "reprise";

/**
 * Un relevé de plus, et ce qu'il faut en dire.
 *
 * `pret >= 3` (HAVE_FUTURE_DATA) est la garde qui distingue un GEL d'un
 * chargement : pendant un buffering ordinaire la position stagne aussi, mais
 * l'état de préparation retombe.
 *
 * Une erreur n'est plus traitée à part. Elle n'appelait un chemin propre que
 * pour décider s'il fallait recharger ; maintenant qu'on ne recharge plus, elle
 * n'est qu'un renseignement de plus à joindre au journal — l'appelant la lit
 * directement sur l'élément.
 */
export function observer(etat: EtatVeille, e: EchantillonLecture): [EtatVeille, Verdict] {
  const instant = e.instant ?? 0;

  // En pause voulue, ou pas assez de données : il n'y a rien à surveiller, et
  // surtout rien à reprocher au lecteur. Un gel déjà constaté le reste — un
  // buffering au milieu n'est pas une reprise.
  if (e.enPause || e.pret < 3) {
    return [{ ...etat, derniere: e.position, immobiles: 0 }, "rien"];
  }

  const avance = etat.derniere !== null && e.position - etat.derniere > TOLERANCE_PROGRESSION_S;
  if (avance || etat.derniere === null) {
    const suivant: EtatVeille = { derniere: e.position, immobiles: 0, fige: null };
    return [suivant, etat.fige !== null ? "reprise" : "rien"];
  }

  const immobiles = etat.immobiles + 1;
  if (etat.fige === null && immobiles >= RELEVES_AVANT_GEL) {
    return [{ derniere: e.position, immobiles, fige: instant }, "fige"];
  }
  return [{ ...etat, derniere: e.position, immobiles }, "rien"];
}
