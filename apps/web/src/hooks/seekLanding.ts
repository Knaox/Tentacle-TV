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
 * annulaient le minuteur (cf. `useVideoEvents`). Relevé sur la dalle, `seeked`
 * part à `readyState 2` avec la cible AU-DELÀ du tampon : il annonce la fin d'une
 * recherche, pas la disponibilité d'une image.
 *
 * # Pourquoi `buffered` ne peut pas servir de preuve
 *
 * La tentation est de demander « le tampon couvre-t-il la cible ». Sur la pile
 * média du téléviseur, la plage rendue est TOUJOURS unique et commence à zéro :
 * `bufferDebut` vaut 0 sur 13 678 des 13 731 relevés du dépôt, et `null` sur les
 * 53 autres — jamais rien d'autre. Tout saut en arrière du film serait donc jugé
 * « abouti » d'office, et le filet ne servirait précisément à rien sur le cas le
 * plus fréquent. Seule la BORNE HAUTE de ce tampon veut dire quelque chose.
 *
 * # Le témoin honnête
 *
 * De la vidéo qui SORT, au voisinage de la cible. C'est la même conclusion que
 * `relanceGel.ts` côté téléviseur, et pour la même raison : la position qui
 * avance est la seule chose que le lecteur ne peut pas simuler. Le voisinage
 * compte autant que la progression — on a relevé la pile rejouant une seconde
 * d'une position ANCIENNE avant de se figer, ce qui ressemblerait sinon à un
 * atterrissage.
 *
 * Un saut demandé à l'arrêt ne produit aucune progression : il est jugé, lui, sur
 * des données servies au-delà de la cible.
 *
 * # Ce que ce module ne juge pas
 *
 * Il répond « le déplacement a-t-il abouti », pas « la lecture avance-t-elle ».
 * Un film qui se fige APRÈS un saut réussi relève de la veille de gel
 * (`relanceGel.ts`), qui surveille la progression sans se soucier d'une cible.
 */

/** Ce qu'on observe d'un saut en cours, sans dépendre du DOM pour les tests. */
export interface SeekSample {
  /** La cible du saut, en temps PTS de l'élément vidéo. */
  target: number;
  /** `v.currentTime` au relevé. */
  position: number;
  /**
   * Fin de la plage `buffered` la plus avancée, `null` s'il n'y en a aucune.
   * On ne retient QUE cette borne : cf. le docblock, le début ment.
   */
  bufferEnd: number | null;
  /** `v.paused` — une pause voulue n'est pas un calage. */
  paused: boolean;
  /** `HTMLMediaElement.readyState` — 3 = HAVE_FUTURE_DATA. */
  ready: number;
  /**
   * Millisecondes depuis l'armement de la veille. Le module reste pur : c'est
   * l'appelant qui lit l'horloge, et les tests la fabriquent.
   */
  elapsed: number;
}

export interface SeekState {
  /** Position du relevé précédent, `null` avant le premier. */
  last: number | null;
}

export const EMPTY_SEEK: SeekState = { last: null };

/**
 * - `"landed"` — des images sont sorties là où on les voulait.
 * - `"loading"` — rien encore, mais il est trop tôt pour renoncer : c'est le
 *   moment de le DIRE à l'utilisateur, pas d'agir.
 * - `"renegotiate"` — le déplacement n'a rien produit, il faut une session neuve.
 */
export type SeekVerdict = "wait" | "landed" | "loading" | "renegotiate";

/**
 * Au bout de combien de temps un saut HLS est considéré comme calé.
 *
 * Huit secondes, et non trois comme l'annonçaient les commentaires : la valeur
 * est là depuis toujours, seule sa documentation était fausse. Et il ne faut
 * surtout pas la descendre — un saut qui ABOUTIT a été mesuré à 4,5 secondes sur
 * cette dalle (`seeking` → `canplay`). C'est le verdict qui était faux, pas
 * l'échéance : la garder telle quelle est ce qui rend la correction neutre pour
 * hls.js, mpv, Tauri et Electron.
 */
export const SEEK_STALL_MS = 8000;

/**
 * Au bout de combien de temps on DIT que ça charge.
 *
 * Une demi-seconde. En dessous, le témoin clignoterait sur des sauts qui
 * aboutissent tout de suite — c'est le défaut qui avait fait retirer l'ancien
 * indicateur. Au-dessus, l'écran reste figé sans explication.
 *
 * Le même seuil sert à l'attente en cours de lecture (`useVideoEvents`), pour
 * que le lecteur ne se contredise pas d'un chemin à l'autre.
 */
export const LOADING_MS = 500;

/**
 * À quelle cadence relever.
 *
 * Un minuteur unique ne pouvait conclure qu'une fois ; une veille périodique
 * s'arrête d'elle-même dès que la lecture est repartie, ce qui est le cas courant
 * et ne coûte alors qu'un ou deux relevés.
 *
 * Alignée sur `LOADING_MS` : le premier relevé tombe donc AU seuil, et
 * le témoin de chargement ne s'allume pas une demi-seconde en retard.
 */
export const SEEK_WATCH_PERIOD_MS = LOADING_MS;

/** De combien la position doit avancer entre deux relevés pour compter. */
export const MIN_PROGRESS_S = 0.25;

/** À quelle distance de la cible on considère qu'on a atterri. */
export const LANDING_TOLERANCE_S = 2;

/**
 * Un relevé de plus, et ce qu'il faut en faire.
 *
 * L'ordre des règles est le fond de l'affaire : l'aboutissement se constate AVANT
 * tout compte à rebours, sinon un saut réussi en une seconde resterait « en
 * attente » pendant les sept suivantes.
 */
export function observeSeek(state: SeekState, e: SeekSample): [SeekState, SeekVerdict] {
  const next: SeekState = { last: e.position };
  const nearTarget = e.position >= e.target - LANDING_TOLERANCE_S;

  // De la vidéo est sortie, et là où on la voulait.
  const advanced = state.last !== null && e.position - state.last > MIN_PROGRESS_S;
  if (advanced && nearTarget) return [next, "landed"];

  // Un saut demandé à l'arrêt ne fera avancer personne : ce qui le prouve est que
  // le serveur a servi au-delà de la cible.
  const served = e.bufferEnd !== null && e.bufferEnd > e.target;
  if (e.paused && e.ready >= 3 && nearTarget && served) return [next, "landed"];

  // En pause voulue, renégocier ferait repartir la lecture sous les doigts de
  // l'utilisateur. On ne conclut pas, on attend qu'il reprenne — et surtout on
  // ne dit pas « ça charge » : rien n'est censé avancer, un témoin allumé sur
  // une pause resterait allumé pour toujours.
  if (e.paused) return [next, "wait"];

  if (e.elapsed >= SEEK_STALL_MS) return [next, "renegotiate"];
  if (e.elapsed >= LOADING_MS) return [next, "loading"];
  return [next, "wait"];
}
