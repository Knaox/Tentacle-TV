/**
 * Le TON de ce qu'il y a sous une surface de verre — `dark` ou `light` —, d'où
 * la polarité de ses glyphes : clair dessous → glyphes sombres, et inversement
 * (Apple : la lisibilité s'adapte au contenu, jamais un fond sombre).
 *
 * La page ne lit pas ses propres pixels ; la coquille, si : son pont peut
 * offrir `liquidGlass.sample(rects)` (médiane de la luminance relative de
 * chaque rectangle, par `webContents.capturePage`). Sans lui, le ton du thème.
 *
 * Ce module est l'ordonnanceur, pur par ses dépendances : un appel au plus par
 * intervalle, regroupé pour toutes les surfaces, et seulement quand on le lui
 * demande (montage, fin de défilement, taille, survol, minuterie lente) —
 * jamais à chaque image. Une hystérésis empêche le ton de clignoter sur un
 * contenu de luminance moyenne.
 */

export type BackdropTone = "dark" | "light";

export interface ToneRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Échantillonneur de la coquille : une luminance (0..1) ou `null` par rectangle. */
export type ToneSampler = (rects: readonly ToneRect[]) => Promise<ReadonlyArray<number | null>>;

/** Au-dessus : clair dessous (glyphes sombres). */
export const TONE_LIGHT_ABOVE = 0.56;
/** En dessous : sombre dessous (glyphes clairs). Entre les deux : on garde. */
export const TONE_DARK_BELOW = 0.4;

/** Le ton suivant, d'après une luminance mesurée (hystérésis). */
export function nextTone(previous: BackdropTone, luminance: number | null): BackdropTone {
  if (luminance === null || !Number.isFinite(luminance)) return previous;
  if (luminance >= TONE_LIGHT_ABOVE) return "light";
  if (luminance <= TONE_DARK_BELOW) return "dark";
  return previous;
}

interface Watched {
  rect: () => ToneRect | null;
  tone: BackdropTone;
  onTone: (tone: BackdropTone) => void;
}

export interface ToneSchedulerDeps {
  sampler: ToneSampler;
  now: () => number;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  /** Intervalle minimal entre deux appels. */
  minIntervalMs?: number;
}

export interface ToneScheduler {
  watch(id: string, rect: () => ToneRect | null, initial: BackdropTone, onTone: (tone: BackdropTone) => void): void;
  unwatch(id: string): void;
  /** Demande une mesure (regroupée, au plus une par intervalle). */
  request(): void;
  readonly size: number;
}

export const TONE_MIN_INTERVAL_MS = 250;
/** Au plus, par appel : la limite de la coquille (`MAX_SAMPLE_RECTS`). */
export const TONE_MAX_RECTS = 32;

export function createToneScheduler(deps: ToneSchedulerDeps): ToneScheduler {
  const watched = new Map<string, Watched>();
  const minInterval = deps.minIntervalMs ?? TONE_MIN_INTERVAL_MS;
  let lastRun = Number.NEGATIVE_INFINITY;
  let timer: unknown = null;
  let inFlight = false;
  let again = false;

  async function run(): Promise<void> {
    timer = null;
    if (inFlight) {
      again = true;
      return;
    }
    const batch: Array<[string, ToneRect]> = [];
    for (const [id, entry] of watched) {
      const rect = entry.rect();
      if (rect !== null && rect.width >= 1 && rect.height >= 1) batch.push([id, rect]);
      if (batch.length === TONE_MAX_RECTS) break;
    }
    if (batch.length === 0) return;
    inFlight = true;
    lastRun = deps.now();
    try {
      const values = await deps.sampler(batch.map(([, rect]) => rect));
      batch.forEach(([id], index) => {
        const entry = watched.get(id);
        if (entry === undefined) return;
        const tone = nextTone(entry.tone, values[index] ?? null);
        if (tone === entry.tone) return;
        entry.tone = tone;
        entry.onTone(tone);
      });
    } catch {
      /* La coquille n'a pas su capturer : les tons restent ce qu'ils étaient. */
    } finally {
      inFlight = false;
      if (again) {
        again = false;
        request();
      }
    }
  }

  function request(): void {
    if (timer !== null || watched.size === 0) return;
    const wait = Math.max(0, lastRun + minInterval - deps.now());
    timer = deps.setTimer(() => void run(), wait);
  }

  return {
    watch(id, rect, initial, onTone) {
      watched.set(id, { rect, tone: initial, onTone });
      request();
    },
    unwatch(id) {
      watched.delete(id);
      if (watched.size === 0 && timer !== null) {
        deps.clearTimer(timer);
        timer = null;
      }
    },
    request,
    get size() {
      return watched.size;
    },
  };
}
