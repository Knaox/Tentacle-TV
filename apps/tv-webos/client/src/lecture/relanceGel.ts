/**
 * Reconnaître une lecture figée, et savoir quand la relancer.
 *
 * # Ce qu'on a vu sur la dalle
 *
 * Un film Dolby Vision en remux, un saut de quarante minutes, et la lecture
 * s'arrête. L'élément vidéo dit alors :
 *
 *     currentTime 2719.5 (immobile)   paused true    readyState 4
 *     buffered 0-2738 (19 s d'avance) error.code 2
 *
 * Tout paraît sain — des données en avance, un état « prêt à lire » — sauf que
 * plus rien n'avance, et que rien ne le signale à l'utilisateur : ni roue de
 * chargement, ni message. Le film est perdu.
 *
 * **`error.code === 2` est `MEDIA_ERR_NETWORK`**, et c'est le fond de l'affaire :
 * l'échelle de repli (`repliLecture.ts`) n'écoute que les codes 3
 * (`MEDIA_ERR_DECODE`) et 4 (`MEDIA_ERR_SRC_NOT_SUPPORTED`) — à raison, ce sont
 * les seuls qui disent qu'un codec a été refusé. Une coupure réseau sur un
 * segment n'est pas de cette nature : il n'y a aucune capacité à retirer du
 * profil, juste un flux à reprendre. Personne ne l'écoutait.
 *
 * # Le remède, mesuré
 *
 * `play()` est accepté sans effet. Un micro-saut déplace la position sans que
 * la lecture reparte. Seul `load()` suivi d'un repositionnement débloque le
 * pipeline — vérifié : la lecture est repartie de 2718 et a poursuivi
 * normalement, l'erreur effacée. Il n'est donc pas nécessaire de renégocier une
 * source auprès du serveur : le flux est bon, c'est le lecteur qui est resté en
 * arrière.
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
 * En dessous, une saccade de décodage suffirait à déclencher un rechargement —
 * qui coûte, lui, une vraie coupure.
 */
export const RELEVES_AVANT_GEL = 3;

/**
 * Combien de relances avant d'abandonner.
 *
 * Au-delà, la cause n'est pas passagère et insister ne ferait que hacher la
 * lecture. On préfère laisser l'image figée et le dire au journal : c'est
 * désagréable, mais au moins c'est diagnosticable.
 */
export const RELANCES_MAX = 3;

/**
 * Combien de relances tolérées sur une fenêtre glissante, et sur quelle durée.
 *
 * `RELANCES_MAX` seul ne plafonnait rien : son compteur retombait à zéro dès que
 * la position avançait d'un quart de seconde, si bien qu'il ne bornait que des
 * échecs consécutifs SANS aucune progression entre eux. Un film qui se fige
 * toutes les quarante secondes — ce qu'on a mesuré sur la dalle — était donc
 * relancé indéfiniment, et le verdict « épuisé », le seul qui écrive quelque
 * chose de définitif au journal, ne sortait jamais. La veille masquait le
 * défaut au lieu de le signaler.
 *
 * Quatre relances en cinq minutes ne sont plus un incident : c'est une lecture
 * inregardable, et il vaut mieux le dire que la hacher un peu plus.
 */
export const RELANCES_PAR_FENETRE = 4;
export const FENETRE_CUMUL_MS = 5 * 60 * 1000;

export interface EtatVeille {
  /** Position du dernier relevé, `null` avant le premier. */
  derniere: number | null;
  /** Relevés consécutifs sans progression. */
  immobiles: number;
  /** Relances déjà tentées pour cette source. */
  relances: number;
  /** Instants des relances retenues dans la fenêtre glissante. */
  historique: number[];
}

export const VEILLE_VIDE: EtatVeille = { derniere: null, immobiles: 0, relances: 0, historique: [] };

export type Verdict = "rien" | "relancer" | "epuise";

/**
 * Un relevé de plus, et ce qu'il faut en faire.
 *
 * `pret >= 3` (HAVE_FUTURE_DATA) est la garde qui distingue un GEL d'un
 * chargement : pendant un buffering ordinaire la position stagne aussi, mais
 * l'état de préparation retombe. Sans elle, on rechargerait la source au moindre
 * ralentissement du réseau — en aggravant précisément ce qu'on veut corriger.
 *
 * Une erreur réseau tranche immédiatement : elle est déjà la preuve que le
 * lecteur a renoncé, il n'y a rien à confirmer.
 */
export function observer(etat: EtatVeille, e: EchantillonLecture): [EtatVeille, Verdict] {
  const instant = e.instant ?? 0;
  if (e.erreur === MEDIA_ERR_NETWORK) {
    return decider({ ...etat, derniere: e.position, immobiles: RELEVES_AVANT_GEL }, instant);
  }

  // En pause voulue, ou pas assez de données : il n'y a rien à surveiller, et
  // surtout rien à reprocher au lecteur.
  if (e.enPause || e.pret < 3) {
    return [{ ...etat, derniere: e.position, immobiles: 0 }, "rien"];
  }

  // Une tolérance, parce que `currentTime` ne progresse pas au millième près
  // entre deux relevés : en dessous d'un quart de seconde en quatre secondes,
  // il ne se passe rien de bon.
  const avance = etat.derniere !== null && e.position - etat.derniere > 0.25;
  if (avance || etat.derniere === null) {
    return [{ ...etat, derniere: e.position, immobiles: 0, relances: avance ? 0 : etat.relances }, "rien"];
  }

  return decider({ ...etat, derniere: e.position, immobiles: etat.immobiles + 1 }, instant);
}

function decider(etat: EtatVeille, instant: number): [EtatVeille, Verdict] {
  if (etat.immobiles < RELEVES_AVANT_GEL) return [etat, "rien"];
  // La fenêtre glissante, elle, ne se laisse pas remettre à zéro par une
  // poignée de secondes de lecture entre deux gels.
  const recentes = etat.historique.filter((t) => instant - t < FENETRE_CUMUL_MS);
  if (etat.relances >= RELANCES_MAX || recentes.length >= RELANCES_PAR_FENETRE) {
    return [{ ...etat, immobiles: 0, historique: recentes }, "epuise"];
  }
  return [{
    ...etat, immobiles: 0, relances: etat.relances + 1, historique: [...recentes, instant],
  }, "relancer"];
}
