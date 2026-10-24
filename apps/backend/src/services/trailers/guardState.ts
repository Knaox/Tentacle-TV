/* ------------------------------------------------------------------ */
/*  L'état des garde-fous survit au redémarrage                         */
/*                                                                     */
/*  Un disjoncteur ouvert parce que YouTube demande une vérification   */
/*  anti-robot ne doit pas se refermer parce que le serveur redémarre  */
/*  (une mise à jour, le serveur de développement relancé) : c'est la  */
/*  rafale suivante qui aggraverait le blocage. Les disjoncteurs et    */
/*  les budgets de l'heure de YouTube et de Dailymotion s'écrivent dans */
/*  `server_config` (`trailers_guard_state`), quelques secondes après  */
/*  un changement de disjoncteur et au plus une fois par minute pour   */
/*  les budgets, et se reprennent au démarrage. Aucune donnée de       */
/*  compte : des horodatages.                                          */
/* ------------------------------------------------------------------ */

import { getConfigValue, setConfigValue } from "../configStore";
import { dailymotionApiBudget, dailymotionBreaker } from "./dailymotionGuard";
import type { BreakerSnapshot } from "./sourceGuard";
import type { LedgerEntry } from "../youtubeBudget/hostYouTubeLedger";
import { hostYouTubeBudget, playbackBudget, previewBudget, youtubeBreaker } from "./youtubeGuard";

export const GUARD_STATE_KEY = "trailers_guard_state";
const VERSION = 1;
const SAVE_DELAY_MS = 3_000;
const BUDGET_SAVE_EVERY_MS = 60_000;

interface GuardSnapshot {
  version: number;
  /** `host` : le budget de l'hôte (bandes-annonces + extensions) — absent d'un état d'avant, sans conséquence. */
  youtube: { breaker: BreakerSnapshot; preview: number[]; playback: number[]; host?: LedgerEntry[] };
  dailymotion: { breaker: BreakerSnapshot; api: number[] };
}

let saveTimer: NodeJS.Timeout | null = null;
let budgetTimer: NodeJS.Timeout | null = null;
let lastSaved = "";

function snapshot(now = Date.now()): GuardSnapshot {
  return {
    version: VERSION,
    youtube: {
      breaker: youtubeBreaker.snapshot(),
      preview: previewBudget.snapshot(now),
      playback: playbackBudget.snapshot(now),
      host: hostYouTubeBudget.snapshot(now),
    },
    dailymotion: { breaker: dailymotionBreaker.snapshot(), api: dailymotionApiBudget.snapshot(now) },
  };
}

const entries = (value: unknown): LedgerEntry[] =>
  Array.isArray(value)
    ? value.filter((e): e is LedgerEntry => !!e && typeof e === "object" && typeof (e as LedgerEntry).at === "number" && typeof (e as LedgerEntry).source === "string")
    : [];
const times = (value: unknown): number[] => (Array.isArray(value) ? value.filter((t): t is number => typeof t === "number") : []);

/** Reprend un état écrit ; illisible, d'une autre version : on repart de rien, sans erreur. */
export function restoreGuardState(raw: string | undefined, now = Date.now()): void {
  if (!raw) return;
  try {
    const saved = JSON.parse(raw) as Partial<GuardSnapshot>;
    if (saved.version !== VERSION) return;
    if (saved.youtube) {
      youtubeBreaker.restore(saved.youtube.breaker ?? {});
      previewBudget.restore(times(saved.youtube.preview), now);
      playbackBudget.restore(times(saved.youtube.playback), now);
      hostYouTubeBudget.restore(entries(saved.youtube.host), now);
    }
    if (saved.dailymotion) {
      dailymotionBreaker.restore(saved.dailymotion.breaker ?? {});
      dailymotionApiBudget.restore(times(saved.dailymotion.api), now);
    }
  } catch {
    // Une valeur corrompue ne coûte que la mémoire des pauses.
  }
}

/** Écrit l'état s'il a changé depuis la dernière écriture. */
export async function saveGuardState(): Promise<void> {
  const json = JSON.stringify(snapshot());
  if (json === lastSaved) return;
  lastSaved = json;
  await setConfigValue(GUARD_STATE_KEY, json).catch((err: unknown) => {
    lastSaved = "";
    console.warn("[trailers] état des garde-fous non écrit :", err instanceof Error ? err.message : err);
  });
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveGuardState();
  }, SAVE_DELAY_MS);
  saveTimer.unref?.();
}

/** Au démarrage : reprendre l'état, puis l'écrire à chaque changement. */
export function startGuardState(): void {
  restoreGuardState(getConfigValue(GUARD_STATE_KEY));
  lastSaved = JSON.stringify(snapshot());
  youtubeBreaker.onChange(scheduleSave);
  dailymotionBreaker.onChange(scheduleSave);
  if (!budgetTimer) {
    budgetTimer = setInterval(() => void saveGuardState(), BUDGET_SAVE_EVERY_MS);
    budgetTimer.unref?.();
  }
}

/** Pour les tests. */
export function stopGuardState(): void {
  if (saveTimer) clearTimeout(saveTimer);
  if (budgetTimer) clearInterval(budgetTimer);
  saveTimer = null;
  budgetTimer = null;
  youtubeBreaker.onChange(null);
  dailymotionBreaker.onChange(null);
  lastSaved = "";
}
