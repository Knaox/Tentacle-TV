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

/**
 * Seuils en LUMINANCE RELATIVE (linéaire, celle du contraste WCAG). Un glyphe
 * noir contraste mieux qu'un blanc dès que le dessous dépasse ~0,18 (gris
 * moyen : les deux tiennent ~4,5:1) — d'où une bascule tôt, comme chez Apple,
 * et une bande d'hystérésis autour pour ne pas clignoter.
 */
/** Au-dessus : clair dessous (glyphes sombres). */
export const TONE_LIGHT_ABOVE = 0.28;
/** En dessous : sombre dessous (glyphes clairs). Entre les deux : on garde. */
export const TONE_DARK_BELOW = 0.18;

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
  /** Une surface : son ton, rendu quand il change. */
  onTone?: (tone: BackdropTone) => void;
  /** Une bande (`useBandTones`) : la luminance brute, à chaque mesure. */
  onLuminance?: (luminance: number) => void;
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
  /** Une surface : `initial` est le ton supposé avant la mesure (rendu seulement s'il change). */
  watch(id: string, rect: () => ToneRect | null, initial: BackdropTone, onTone: (tone: BackdropTone) => void): void;
  /** Une bande : la luminance mesurée, telle quelle, à chaque appel (même lot, même intervalle). */
  observe(id: string, rect: () => ToneRect | null, onLuminance: (luminance: number) => void): void;
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
  /** Au-delà de `TONE_MAX_RECTS` surfaces : où reprendre, et ce qu'il reste de la tournée. */
  let cursor = 0;
  let roundLeft = 0;

  async function run(): Promise<void> {
    timer = null;
    if (inFlight) {
      again = true;
      return;
    }
    const batch: Array<[string, ToneRect]> = [];
    const entries = [...watched];
    if (roundLeft <= 0) roundLeft = entries.length;
    const quota = Math.min(entries.length, roundLeft);
    let considered = 0;
    while (considered < quota && batch.length < TONE_MAX_RECTS) {
      const [id, entry] = entries[(cursor + considered) % entries.length]!;
      considered += 1;
      const rect = entry.rect();
      if (rect !== null && rect.width >= 1 && rect.height >= 1) batch.push([id, rect]);
    }
    cursor = (cursor + considered) % Math.max(1, entries.length);
    // Plus de surfaces que la coquille n'en mesure par appel : la tournée
    // continue au lot suivant (à l'intervalle), puis s'arrête.
    roundLeft -= considered;
    if (roundLeft > 0) again = true;
    if (batch.length === 0) {
      if (again) {
        again = false;
        request();
      }
      return;
    }
    inFlight = true;
    lastRun = deps.now();
    try {
      const values = await deps.sampler(batch.map(([, rect]) => rect));
      batch.forEach(([id], index) => {
        const entry = watched.get(id);
        if (entry === undefined) return;
        const value = values[index] ?? null;
        if (entry.onLuminance !== undefined) {
          if (value !== null && Number.isFinite(value)) entry.onLuminance(value);
          return;
        }
        const tone = nextTone(entry.tone, value);
        if (tone === entry.tone) return;
        entry.tone = tone;
        entry.onTone?.(tone);
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
    observe(id, rect, onLuminance) {
      watched.set(id, { rect, tone: "dark", onLuminance });
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
