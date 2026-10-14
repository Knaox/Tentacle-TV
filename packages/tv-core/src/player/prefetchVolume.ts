/**
 * Le PRÉCHARGEMENT de l'Apple TV se règle en VOLUME, plus en temps.
 *
 * Avant : 30 s d'avance pour AVPlayer sur une source distante, 10 s sur le
 * bouclage de PrismCore, et un producteur PrismCore bridé à 30 s devant la
 * dernière requête d'AVPlayer. Trente secondes d'un remux 4K pèsent 300 Mo,
 * trente secondes d'un épisode 720p en pèsent 8 : la même durée ne protégeait
 * pas du tout de la même façon. Désormais, chaque lecture s'accorde un
 * BUDGET d'octets, converti en secondes par le débit réel de la source — un
 * épisode de 200 Mo face à un budget de 1 Gio se précharge EN ENTIER, et la
 * barre de préchargement se remplit jusqu'au bout.
 *
 * Deux budgets, parce que deux mémoires :
 *  - PrismCore (bouclage local) écrit ses segments sur le DISQUE (`tmp/`,
 *    purgé par tvOS) : c'est là que vit le gros de l'avance. AVPlayer, lui,
 *    garde son avance courte en MÉMOIRE sur le bouclage — servie en
 *    millisecondes, elle n'a rien à protéger.
 *  - Une source distante (lecture directe Jellyfin, transcodage) n'a que la
 *    mémoire d'AVPlayer : budget plus petit.
 *
 * Les valeurs sont un point de départ RAISONNÉ, pas une mesure : elles se
 * vérifient sur une Apple TV (journal `[prefetch]`, mémoire de l'app) avant
 * d'être poussées plus loin. Les PLANCHERS gardent l'ancien comportement : un
 * débit inconnu ou une source lourde n'ont jamais moins qu'avant.
 */

const MIB = 1024 * 1024;

export const PREFETCH_VOLUME = {
  /** Avance du producteur PrismCore, sur le disque. */
  diskBytes: 1024 * MIB,
  /** Ce que le budget disque garde EN PLUS de l'avance : les segments déjà
   *  lus (retour arrière) et la fenêtre que la rétention ne touche jamais. Le
   *  budget de rétention doit dépasser l'avance — sinon la rétention évince ce
   *  que le producteur vient d'écrire et AVPlayer le redemande. */
  diskMarginBytes: 512 * MIB,
  /** Avance d'AVPlayer sur une source DISTANTE, en mémoire. */
  memoryBytes: 256 * MIB,
  /** Planchers en secondes — l'ancien réglage, jamais moins. */
  floorSec: { remote: 30, loopback: 10, producer: 30 },
} as const;

export interface StreamSize {
  /** Taille du fichier (octets) — `MediaSource.Size`. */
  sizeBytes?: number | null;
  /** Durée du titre (s). */
  durationSec?: number | null;
  /** Débit annoncé (bits/s) — `MediaSource.Bitrate` ou le palier du transcodage. */
  bitrateBps?: number | null;
}

const positive = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * Le débit MOYEN de la source, en octets par seconde. La taille du fichier
 * sur sa durée d'abord — c'est elle qui fait « 200 Mo = tout l'épisode » —,
 * sinon le débit annoncé. `null` : rien de connu.
 */
export function streamByteRate(s: StreamSize): number | null {
  if (positive(s.sizeBytes) && positive(s.durationSec)) return s.sizeBytes / s.durationSec;
  if (positive(s.bitrateBps)) return s.bitrateBps / 8;
  return null;
}

/** Secondes de contenu que `bytes` couvrent, entre le plancher et la durée du titre. */
function secondsFor(bytes: number, byteRate: number | null, floor: number, durationSec?: number | null): number {
  if (!positive(byteRate)) return floor;
  const seconds = bytes / byteRate;
  // Au-delà de la durée, le titre entier : rien de plus à demander.
  const ceiling = positive(durationSec) ? Math.max(floor, Math.ceil(durationSec)) : Infinity;
  return Math.min(ceiling, Math.max(floor, Math.floor(seconds)));
}

/**
 * L'avance d'AVPlayer (`preferredForwardBufferDuration`). Sur le bouclage,
 * l'ancien plancher tel quel : l'avance de PrismCore est sur le disque.
 */
export function avPlayerForwardBufferSec(a: { loopback: boolean; byteRate: number | null; durationSec?: number | null }): number {
  if (a.loopback) return PREFETCH_VOLUME.floorSec.loopback;
  return secondsFor(PREFETCH_VOLUME.memoryBytes, a.byteRate, PREFETCH_VOLUME.floorSec.remote, a.durationSec);
}

export interface PrismPrefetch {
  /** Avance du producteur sur la dernière requête d'AVPlayer, en secondes de contenu. */
  producerLeadSec: number;
  /** Budget disque des segments de la session (rétention), toujours au-dessus de l'avance. */
  segmentCacheBytes: number;
}

/** Ce que la session PrismCore reçoit à son ouverture. */
export function prismPrefetch(a: { byteRate: number | null; durationSec?: number | null }): PrismPrefetch {
  const v = PREFETCH_VOLUME;
  return {
    producerLeadSec: secondsFor(v.diskBytes, a.byteRate, v.floorSec.producer, a.durationSec),
    segmentCacheBytes: v.diskBytes + v.diskMarginBytes,
  };
}

/** Un intervalle préchargé, en secondes de la timeline du lecteur. */
export interface LoadedRange { start: number; end: number }

/**
 * Où s'arrête la barre de préchargement. AVPlayer donne la fin de SA mémoire
 * (`playable`) ; PrismCore, les intervalles déjà écrits sur le disque. La
 * barre suit le plus loin des deux, mais seulement un intervalle qui CONTIENT
 * la position (à `slackSec` près — un segment) : un bloc écrit plus loin,
 * après un saut, n'est pas de l'avance continue.
 */
export function bufferedEnd(a: {
  position: number;
  playable: number;
  ranges?: readonly LoadedRange[];
  durationSec?: number | null;
  slackSec?: number;
}): number {
  const slack = a.slackSec ?? 7;
  let end = Math.max(a.position, a.playable);
  const sorted = [...(a.ranges ?? [])].sort((x, y) => x.start - y.start);
  for (const r of sorted) {
    if (r.start <= end + slack && r.end > end) end = r.end;
  }
  return positive(a.durationSec) ? Math.min(end, a.durationSec) : end;
}
