/**
 * La vidéo d'un aperçu replié, GARÉE (Apple TV, Android TV) — demande du
 * 16/10 : « l'aperçu ne doit jamais gêner la navigation ».
 *
 * Démonter le lecteur (AVPlayer, ExoPlayer) coûte au fil principal de la
 * plateforme : libéré à la fin du fondu de sortie, il tombait au milieu des
 * flèches suivantes — un accroc au moment où l'aperçu se ferme. La vidéo
 * finie de sortir reste donc montée, en pause et invisible (la grande carte
 * est repliée), et ne se démonte qu'au CALME : quand la télécommande n'a rien
 * envoyé depuis `PREVIEW_PARK_QUIET_MS`. Une rafale de flèches ne démonte
 * rien ; le démontage attend qu'elle cesse.
 *
 * Deux sorties de plus : un AUTRE aperçu qui prend la place unique (l'arbitre)
 * libère aussitôt la vidéo garée — il ne la prend qu'après un focus tenu, un
 * moment de calme par nature, et deux lecteurs ne coexistent jamais au-delà ;
 * et au plus tard `PREVIEW_PARK_MAX_MS` après le garage, même si la
 * télécommande ne se tait pas (une flèche tenue longtemps), pour ne pas
 * retenir un décodeur indéfiniment.
 *
 * La règle (`previewParkReleaseAt`) et le garage de l'appareil
 * (`createPreviewParking`) : il suit la télécommande tant qu'une vidéo existe
 * (`watch` — rien ne s'abonne au repos), date le garage et la dernière
 * intention, et démonte à l'heure rendue. Horloge et minuteurs INJECTÉS.
 */

import type { PlayerTimers } from "../player/playerTimers";

/** Le calme de la télécommande après lequel une vidéo garée se démonte : les
 *  mouvements de la dernière flèche (le focus, le repli) sont alors posés. */
export const PREVIEW_PARK_QUIET_MS = 400;
/** Au plus tard, depuis le garage : une vidéo garée se démonte même sans calme. */
export const PREVIEW_PARK_MAX_MS = 6_000;

export interface PreviewParkInput {
  /** L'heure du garage : la vidéo a fini son fondu de sortie. */
  parkedAt: number;
  /** La dernière intention de la télécommande, ou `null` s'il n'y en a jamais eu. */
  lastInputAt: number | null;
}

/** L'heure à laquelle la vidéo garée peut se démonter. */
export function previewParkReleaseAt({ parkedAt, lastInputAt }: PreviewParkInput): number {
  const quiet = lastInputAt === null ? parkedAt : Math.max(parkedAt, lastInputAt + PREVIEW_PARK_QUIET_MS);
  return Math.min(quiet, parkedAt + PREVIEW_PARK_MAX_MS);
}

export interface PreviewParking {
  /** Suit la télécommande tant qu'une vidéo d'aperçu existe (chargée, montrée, garée). Rend l'arrêt. */
  watch(): () => void;
  /** Gare une vidéo maintenant ; `release` la démontera. Rend l'annulation (démontée autrement). */
  park(release: () => void): () => void;
  /** Un autre aperçu prend la place : tout ce qui est garé se démonte. */
  releaseAll(): void;
}

/**
 * Le garage de l'appareil. `observe` : voir passer chaque intention de la
 * télécommande (l'entrée unique, `RemoteInput.observe`) ; rend l'arrêt.
 */
export function createPreviewParking(observe: (listener: () => void) => () => void, timers: PlayerTimers): PreviewParking {
  const parked = new Map<symbol, { at: number; release: () => void }>();
  let lastInputAt: number | null = null;
  let watchers = 0;
  let stopObserving: (() => void) | null = null;
  let timer: unknown = null;

  const schedule = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
    const now = timers.now();
    let next = Number.POSITIVE_INFINITY;
    // Une copie : démonter fait rendre la session, qui peut annuler en retour.
    for (const [key, entry] of [...parked]) {
      const due = previewParkReleaseAt({ parkedAt: entry.at, lastInputAt });
      if (due > now) next = Math.min(next, due);
      else if (parked.delete(key)) entry.release();
    }
    if (next !== Number.POSITIVE_INFINITY) timer = timers.setTimeout(schedule, next - now);
  };

  return {
    watch() {
      watchers += 1;
      stopObserving ??= observe(() => {
        lastInputAt = timers.now();
        if (parked.size > 0) schedule();
      });
      let done = false;
      return () => {
        if (done) return;
        done = true;
        watchers -= 1;
        if (watchers > 0 || stopObserving === null) return;
        stopObserving();
        stopObserving = null;
      };
    },
    park(release) {
      const key = Symbol("parked");
      parked.set(key, { at: timers.now(), release });
      schedule();
      return () => {
        if (parked.delete(key)) schedule();
      };
    },
    releaseAll() {
      const entries = [...parked.values()];
      parked.clear();
      schedule();
      for (const entry of entries) entry.release();
    },
  };
}
