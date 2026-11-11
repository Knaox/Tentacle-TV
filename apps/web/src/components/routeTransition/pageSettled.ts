/**
 * Une page est-elle PRÊTE à se montrer ? — la règle, pure ; `usePageSettled` la nourrit.
 *
 * Deux temps, dans cet ordre :
 *
 * 1. **Les données.** Plus aucune requête de la page en PREMIER chargement (celles qui
 *    tournaient déjà quand elle s'est montée ne sont pas les siennes), deux images de suite —
 *    une requête en amène souvent une autre (les bibliothèques, puis leurs titres).
 * 2. **Les images.** Celles qui sont À L'ÉCRAN ont fini de charger. Tant que les données
 *    manquaient, on ne savait même pas lesquelles ce serait.
 *
 * Chaque temps a son plafond : un serveur lent ne retient jamais la page quittée plus de
 * `PAGE_HOLD_DATA_MS`, des images lentes plus de `PAGE_HOLD_IMAGES_MS` de plus. Passé cela, la
 * page se montre comme elle est — ses squelettes, ses couleurs d'attente — et se complète sous
 * les yeux. La retenir davantage ferait d'un chargement un gel.
 *
 * Ces durées ne sont pas des durées d'animation : rien ne bouge pendant qu'elles courent.
 */

/** Le plus long qu'une page quittée attend les DONNÉES de la suivante. */
export const PAGE_HOLD_DATA_MS = 1000;
/** Le plus long qu'elle attend ensuite ses IMAGES à l'écran. */
export const PAGE_HOLD_IMAGES_MS = 300;
/** Images de suite sans requête en premier chargement avant de croire les données complètes. */
export const QUIET_FRAMES = 2;

export interface SettleState {
  /** Instant du montage de la page. */
  mountedAt: number;
  /** Images consécutives sans requête en premier chargement. */
  quietFrames: number;
  /** Instant où les données ont été tenues pour complètes ; `null` : pas encore. */
  dataAt: number | null;
  settled: boolean;
}

export interface SettleSample {
  now: number;
  /** Requêtes de la page en premier chargement. */
  pendingQueries: number;
  /** Images à l'écran, dans la page, qui n'ont pas fini de charger. */
  pendingImages: number;
}

export function initialSettleState(now: number): SettleState {
  return { mountedAt: now, quietFrames: 0, dataAt: null, settled: false };
}

/** Une image de plus : où en est la page ? */
export function advanceSettle(state: SettleState, sample: SettleSample): SettleState {
  if (state.settled) return state;
  let { quietFrames, dataAt } = state;
  if (dataAt === null) {
    quietFrames = sample.pendingQueries === 0 ? quietFrames + 1 : 0;
    if (quietFrames >= QUIET_FRAMES || sample.now - state.mountedAt >= PAGE_HOLD_DATA_MS) dataAt = sample.now;
  }
  const settled = dataAt !== null && (sample.pendingImages === 0 || sample.now - dataAt >= PAGE_HOLD_IMAGES_MS);
  return { mountedAt: state.mountedAt, quietFrames, dataAt, settled };
}

/**
 * Les images d'un sous-arbre qui sont à l'écran et n'ont pas fini de charger. Une image en
 * échec est « finie » (`complete`) : son repli prendra sa place. Une image sans adresse n'est
 * attendue par personne.
 */
export function countPendingImages(root: ParentNode, viewport: { width: number; height: number }): number {
  let pending = 0;
  for (const image of root.querySelectorAll("img")) {
    if (image.complete || !image.currentSrc && !image.getAttribute("src")) continue;
    const box = image.getBoundingClientRect();
    const onScreen = box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < viewport.height && box.right > 0 && box.left < viewport.width;
    if (onScreen) pending += 1;
  }
  return pending;
}
