import type { ScrubCountdownOutcome, ScrubCountdownPolicy } from "./scrubCountdown";

/**
 * Le réglage « Avance rapide » de l'Apple TV — ce que fait le décompte du
 * défilement à son terme (`scrubCountdown.ts`), et au bout de combien :
 *
 *  - « À la fin du décompte » : revenir où l'on était (`return`, le DÉFAUT —
 *    on a lâché la télécommande, on ne retrouve pas le film déplacé) ou
 *    reprendre à la nouvelle position (`resume`, le comportement d'avant) ;
 *  - « Délai » : 3, 5 (défaut), 10 ou 15 s.
 *
 * Réglage d'un COMPTE, rangé sur le téléviseur : plusieurs profils se
 * partagent une même Apple TV, chacun garde le sien — une clé par
 * identifiant Jellyfin (`scrubCountdownKey`), jamais une clé d'appareil. Rien
 * n'est écrit tant qu'on n'a pas choisi : l'absence vaut le défaut.
 *
 * Android TV n'a pas le réglage : son lecteur garde la politique d'avant
 * (`RESUME_COUNTDOWN_POLICY`). Module pur, stockage injecté.
 */

/** Les délais offerts, en secondes. */
export const SCRUB_COUNTDOWN_DELAYS = [3, 5, 10, 15] as const;

export type ScrubCountdownDelay = (typeof SCRUB_COUNTDOWN_DELAYS)[number];

export interface ScrubCountdownSettings {
  outcome: ScrubCountdownOutcome;
  delaySeconds: ScrubCountdownDelay;
}

/** Le défaut, décision de produit (2026-10-04) : revenir, au bout de 5 s. */
export const SCRUB_COUNTDOWN_DEFAULTS: ScrubCountdownSettings = Object.freeze({ outcome: "return", delaySeconds: 5 });

/** La politique que le lecteur applique pour ce réglage. */
export function scrubCountdownPolicyOf(settings: ScrubCountdownSettings): ScrubCountdownPolicy {
  return { outcome: settings.outcome, delayMs: settings.delaySeconds * 1000 };
}

/** Préfixe de la clé de stockage — traversée par une chaîne : ne jamais la
 *  renommer (cf. CLAUDE.md). La clé entière : préfixe + identifiant Jellyfin. */
export const SCRUB_COUNTDOWN_KEY_PREFIX = "tentacle_scrub_countdown:";

export function scrubCountdownKey(userId: string): string {
  return `${SCRUB_COUNTDOWN_KEY_PREFIX}${userId}`;
}

const isOutcome = (value: unknown): value is ScrubCountdownOutcome => value === "return" || value === "resume";
const isDelay = (value: unknown): value is ScrubCountdownDelay =>
  (SCRUB_COUNTDOWN_DELAYS as readonly unknown[]).includes(value);

/**
 * La valeur stockée (`{"outcome":"return","delay":5}` — noms de champs
 * traversés par une chaîne, eux aussi), lue champ par champ : un champ
 * absent ou inconnu vaut son défaut, sans emporter l'autre.
 */
export function parseScrubCountdownSettings(raw: string | null): ScrubCountdownSettings {
  if (!raw) return SCRUB_COUNTDOWN_DEFAULTS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return SCRUB_COUNTDOWN_DEFAULTS;
  }
  if (!parsed || typeof parsed !== "object") return SCRUB_COUNTDOWN_DEFAULTS;
  const { outcome, delay } = parsed as { outcome?: unknown; delay?: unknown };
  return {
    outcome: isOutcome(outcome) ? outcome : SCRUB_COUNTDOWN_DEFAULTS.outcome,
    delaySeconds: isDelay(delay) ? delay : SCRUB_COUNTDOWN_DEFAULTS.delaySeconds,
  };
}

export function serializeScrubCountdownSettings(settings: ScrubCountdownSettings): string {
  return JSON.stringify({ outcome: settings.outcome, delay: settings.delaySeconds });
}

/** Le minimum d'un stockage synchrone (l'adaptateur du téléviseur). */
export interface ScrubCountdownStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ScrubCountdownStore {
  /** Le réglage du compte ; sans compte, le défaut. Même objet tant que la
   *  valeur stockée ne change pas (instantané stable pour React). */
  read(userId: string | null): ScrubCountdownSettings;
  /** Sans compte, rien ne s'écrit. */
  write(userId: string | null, patch: Partial<ScrubCountdownSettings>): void;
  subscribe(listener: () => void): () => void;
}

export function createScrubCountdownStore(storage: ScrubCountdownStorage): ScrubCountdownStore {
  const listeners = new Set<() => void>();
  /** Le dernier instantané lu par compte, et la chaîne dont il vient. */
  const cache = new Map<string, { raw: string | null; settings: ScrubCountdownSettings }>();

  const readRaw = (userId: string): string | null => {
    try {
      return storage.getItem(scrubCountdownKey(userId));
    } catch {
      return null;
    }
  };

  const read = (userId: string | null): ScrubCountdownSettings => {
    if (!userId) return SCRUB_COUNTDOWN_DEFAULTS;
    const raw = readRaw(userId);
    const cached = cache.get(userId);
    if (cached && cached.raw === raw) return cached.settings;
    const settings = parseScrubCountdownSettings(raw);
    cache.set(userId, { raw, settings });
    return settings;
  };

  return {
    read,
    write(userId, patch) {
      if (!userId) return;
      const current = read(userId);
      const next = { ...current, ...patch };
      if (next.outcome === current.outcome && next.delaySeconds === current.delaySeconds) return;
      const raw = serializeScrubCountdownSettings(next);
      try {
        storage.setItem(scrubCountdownKey(userId), raw);
      } catch {
        // Stockage indisponible : le choix ne tient pas, l'écran garde l'ancien.
        return;
      }
      cache.set(userId, { raw, settings: next });
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
