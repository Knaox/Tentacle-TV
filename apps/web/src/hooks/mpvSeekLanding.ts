/**
 * Où mpv atterrit vraiment sur un HLS Jellyfin — et comment l'y faire arriver.
 *
 * # Ce qu'on a mesuré (16 septembre 2026, mpv 0.37 sans écran, Jellyfin 10.11)
 *
 * La playlist de Jellyfin annonce le segment N à N × 3 s, mais le ffmpeg relancé
 * pour le produire (`-ss N × 3`) part de l'image clé VOISINE — la suivante, une
 * à dix secondes plus loin selon le fichier. mpv lit les horodatages réels des
 * segments et rapporte honnêtement où il est ; c'est l'ATTERRISSAGE qui est
 * faux, pas la position :
 *
 *     --start=+500       → première image à 501,042 s
 *     seek 100 absolute  → première image à 102,060 s
 *
 * En séance Watch Together, un lecteur qui se cale sur une cible et atterrit
 * une seconde trop loin n'est jamais « posé » ; la boucle de dérive le renvoie
 * à la cible, qui le rend au même endroit — une spirale de seeks.
 *
 * # Le levier
 *
 * `hr-seek-demuxer-offset` : mpv recule le démuxeur de ce nombre de secondes
 * AVANT la cible, puis décode et jette les images jusqu'à elle — c'est le
 * mécanisme de ses seeks précis, qu'un HLS ne permettait pas à lui seul, la
 * playlist mentant sur le contenu des segments. Avec douze secondes de recul,
 * mesuré sur le même fichier :
 *
 *     --start=+500       → 500,000 s
 *     seek 100 absolute  → 100,017 s
 *
 * Le coût est le décodage de ces douze secondes et de leur téléchargement — une
 * seconde environ en décodage matériel, et seulement en transcodage : en lecture
 * directe le recul vaut zéro, les seeks précis de mpv y sont déjà exacts.
 *
 * # Le repli
 *
 * Douze secondes couvrent les intervalles d'images clés courants (dix secondes
 * au plus sur un WEB-DL). Un fichier aux images clés plus rares atterrit encore
 * en retard : on le mesure au premier atterrissage, on élargit le recul d'autant,
 * et on refait le seek — une fois. La décision est pure et testée ; le
 * branchement sur mpv vit dans `useMpvExactSeek.ts`.
 */

/** Recul initial du démuxeur sur un flux HLS (secondes). */
export const MPV_HLS_SEEK_BACKOFF_S = 12;
/** Recul maximal : au-delà, on décode plus qu'on ne regarde. */
export const MPV_HLS_SEEK_BACKOFF_MAX_S = 30;
/** Marge ajoutée au retard mesuré quand on élargit le recul (secondes). */
export const MPV_SEEK_BACKOFF_MARGIN_S = 3;
/**
 * Retard toléré à l'atterrissage (secondes) : la position se lit jusqu'à 250 ms
 * après l'arrivée (état React à 4 Hz) plus 125 ms d'étranglement, et la lecture
 * a pu reprendre entre-temps ; un atterrissage d'image clé, lui, se compte en
 * secondes.
 */
export const MPV_SEEK_LATE_TOLERANCE_S = 0.75;
/** Au-delà, l'atterrissage n'est plus attendu (seek perdu, source changée). */
export const MPV_SEEK_LANDING_TIMEOUT_MS = 20_000;
/** Reprises d'un même seek après un atterrissage en retard. */
export const MPV_SEEK_RELANDINGS_MAX = 1;

/** Le recul à poser avant d'ouvrir une source. */
export function initialSeekBackoffS(isHls: boolean): number {
  return isHls ? MPV_HLS_SEEK_BACKOFF_S : 0;
}

export interface SeekLandingInput {
  /** Cible du seek (secondes de flux). */
  targetS: number;
  /** Où mpv a atterri (secondes de flux). */
  landedS: number;
  /** Recul en vigueur au moment du seek (secondes). */
  backoffS: number;
  isHls: boolean;
  /** Reprises déjà faites pour ce seek. */
  relandings: number;
}

export type SeekLandingDecision =
  | { kind: "landed" }
  /** En retard : le recul à retenir, et s'il faut refaire le seek. */
  | { kind: "late"; lateS: number; backoffS: number; reseek: boolean };

export function decideSeekLanding(input: SeekLandingInput): SeekLandingDecision {
  const lateS = input.landedS - input.targetS;
  // En avance, ou dans la tolérance : rien à faire. Hors HLS non plus — la
  // précision des seeks de mpv y est déjà celle du fichier.
  if (!input.isHls || !Number.isFinite(lateS) || lateS <= MPV_SEEK_LATE_TOLERANCE_S) return { kind: "landed" };
  const backoffS = Math.min(
    MPV_HLS_SEEK_BACKOFF_MAX_S,
    Math.ceil(input.backoffS + lateS + MPV_SEEK_BACKOFF_MARGIN_S),
  );
  return {
    kind: "late",
    lateS,
    backoffS,
    reseek: input.relandings < MPV_SEEK_RELANDINGS_MAX && backoffS > input.backoffS,
  };
}
