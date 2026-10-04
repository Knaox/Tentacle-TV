/**
 * Le SAUT pendant un transcodage — une seule règle pour le mobile (mpv et
 * lecteur système), l'iPad, le web (hls.js) et le bureau (mpv), comme sur
 * l'Apple TV.
 *
 * Sauter loin dans un flux converti demande à Jellyfin un segment qu'il n'a
 * pas encore produit : il arrête son ffmpeg et le relance à ce point. Rien ne
 * le disait — l'image restait figée, sans un mot, le temps du redémarrage.
 * Deux règles :
 *
 * 1. **Des sauts rapides = UN seul redémarrage.** Chaque saut part de la cible
 *    du précédent (pas d'une position périmée), et le lecteur n'est déplacé
 *    qu'une fois les appuis calmés (`SEEK_SETTLE_MS`) : cinq « +30 s » font un
 *    saut de 2 min 30, et un seul ffmpeg relancé au lieu de cinq.
 * 2. **Le chargement se voit.** L'indicateur tout de suite (dès le premier
 *    appui), une phrase après `SEEK_SLOW_HINT_MS` (« le serveur prépare la
 *    vidéo à ce passage »), le modèle d'erreur unique au délai dépassé
 *    (`SEEK_TIMEOUT_MS`, cause `seekTimeout`) — avec « Réessayer » au même
 *    passage.
 *
 * Hors transcodage (lecture directe, fichier local), le saut part tout de
 * suite : le lecteur y lit des octets déjà disponibles.
 */

/** Le calme après le dernier appui avant de déplacer le lecteur. */
export const SEEK_SETTLE_MS = 600;
/** La phrase sous l'indicateur — à l'Apple TV, le même délai de patience. */
export const SEEK_SLOW_HINT_MS = 5_000;
/**
 * Au-delà, la main à l'utilisateur. Un serveur peu puissant met parfois
 * plusieurs dizaines de secondes à relancer une conversion lourde (4K, HDR,
 * sous-titres incrustés) : une minute sans image, c'est une panne.
 */
export const SEEK_TIMEOUT_MS = 60_000;

/** Une demande de saut : vers une position du film, ou d'un écart depuis la cible en cours. */
export type SeekRequest = { to: number } | { by: number };

/** Les sauts en attente d'être appliqués au lecteur. */
export interface PendingSeek {
  /** La position visée, en secondes du film, déjà bornée. */
  target: number;
  /** Le dernier appui (horloge de l'appelant). */
  lastAt: number;
}

/**
 * Un appui de plus : la cible cumulée. `base` est la position de départ du
 * PREMIER appui — ensuite, chaque écart part de la cible précédente. Bornée à
 * `[0, durée]` (durée inconnue : 0, rien en haut).
 */
export function accumulateSeek(
  pending: PendingSeek | null,
  request: SeekRequest,
  base: number,
  now: number,
  duration: number,
): PendingSeek {
  const from = pending?.target ?? base;
  const raw = "to" in request ? request.to : from + request.by;
  const upper = duration > 0 ? duration : Number.POSITIVE_INFINITY;
  return { target: Math.max(0, Math.min(raw, upper)), lastAt: now };
}

/** Quand appliquer les sauts en attente : après le calme. */
export function seekDueAt(pending: PendingSeek): number {
  return pending.lastAt + SEEK_SETTLE_MS;
}

/**
 * Où en est l'attente d'un saut, depuis le PREMIER appui (`since`) :
 * - `loading` : l'indicateur, tout de suite ;
 * - `slow` : l'indicateur et sa phrase ;
 * - `failed` : le délai est dépassé — le modèle d'erreur.
 */
export type SeekWaitPhase = "idle" | "loading" | "slow" | "failed";

export function seekWaitPhase(since: number | null, now: number): SeekWaitPhase {
  if (since === null) return "idle";
  const elapsed = now - since;
  if (elapsed >= SEEK_TIMEOUT_MS) return "failed";
  if (elapsed >= SEEK_SLOW_HINT_MS) return "slow";
  return "loading";
}

/** Le prochain changement de phase (pour armer UN minuteur), `null` s'il n'y en a plus. */
export function nextSeekWaitChange(since: number | null, now: number): number | null {
  if (since === null) return null;
  for (const at of [since + SEEK_SLOW_HINT_MS, since + SEEK_TIMEOUT_MS]) {
    if (at > now) return at;
  }
  return null;
}

/** En deçà, une position lue est « au passage visé » — un segment de Jellyfin fait 3 à 6 s. */
export const SEEK_LANDING_TOLERANCE_S = 3;

/**
 * Le saut a-t-il abouti ? De la vidéo sort de nouveau (le lecteur ne charge
 * plus et la position avance), au voisinage de la cible. Le voisinage compte :
 * un lecteur rejoue parfois une seconde d'une position ANCIENNE avant de se
 * figer, ce qui ressemblerait sinon à un atterrissage (cf. `seekLanding.ts`
 * du web).
 */
export function seekLanded(sample: { target: number; position: number; advancing: boolean; buffering: boolean }): boolean {
  if (sample.buffering || !sample.advancing) return false;
  // Un peu avant (segment entamé plus tôt) ou plus loin (la lecture a repris
  // et avance depuis) : jamais une position restée loin derrière.
  const offset = sample.position - sample.target;
  return offset >= -SEEK_LANDING_TOLERANCE_S && offset <= SEEK_LANDING_TOLERANCE_S * 4;
}
