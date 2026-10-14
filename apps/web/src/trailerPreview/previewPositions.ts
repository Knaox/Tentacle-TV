/**
 * La POSITION d'un aperçu, retenue quand on quitte sa carte : le retour sur la
 * carte reprend la bande-annonce où on l'avait laissée, au lieu de la relancer
 * depuis son début. Toute la session (requête, `<video>`, hls.js) disparaît à
 * la sortie ; seule la position survit, par bande-annonce, pour la page.
 *
 * La clé est le chemin du flux SANS son jeton — la vidéo, jamais le titre :
 * une décision qui change de bande-annonce ne reprend pas l'autre au milieu.
 * Une position vaut dix minutes ; une bande-annonce finie l'efface. Le coût
 * est nul tant que la même réponse `/preview` sert : listes et segments sont
 * `immutable` dans le cache du navigateur.
 */

const RESUME_TTL_MS = 10 * 60 * 1000;
const MAX_POSITIONS = 200;
/** Trop près de la fin, on ne reprend pas : la bande-annonce finirait aussitôt. */
const END_MARGIN_S = 2;

interface Position {
  at: number;
  until: number;
}

const positions = new Map<string, Position>();

/** La bande-annonce derrière un flux : son chemin sans le jeton (`?t=`). */
export const previewStreamKey = (src: string) => src.split("?")[0];

/** La position où reprendre ce flux, ou `null` (jamais vu, échu, fini). */
export function resumePositionFor(src: string, now = Date.now()): number | null {
  const key = previewStreamKey(src);
  const known = positions.get(key);
  if (!known) return null;
  if (known.until <= now) {
    positions.delete(key);
    return null;
  }
  return known.at;
}

/** Retient la position d'un flux quitté en cours de route (`duration` : pour ne pas reprendre à la fin). */
export function rememberPosition(src: string, at: number, duration: number, now = Date.now()): void {
  const key = previewStreamKey(src);
  if (!(at > 0) || (Number.isFinite(duration) && duration > 0 && at >= duration - END_MARGIN_S)) {
    positions.delete(key);
    return;
  }
  if (positions.size >= MAX_POSITIONS && !positions.has(key)) positions.clear();
  positions.set(key, { at, until: now + RESUME_TTL_MS });
}

/** La bande-annonce est allée au bout : le prochain survol repart du début. */
export function forgetPosition(src: string): void {
  positions.delete(previewStreamKey(src));
}

/** Pour les tests : aucune position retenue. */
export function clearPreviewPositions(): void {
  positions.clear();
}
