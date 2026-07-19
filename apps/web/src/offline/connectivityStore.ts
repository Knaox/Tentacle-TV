/**
 * Store de connectivité — sonde le backend Tentacle ET Jellyfin, applique
 * l'hystérésis de `connectivityMachine.ts` et expose un external store
 * (patron `theme/colorScheme.ts` : module-level + `useSyncExternalStore`).
 *
 * Unique sondeur de l'app : `useServerReachable` (overlay web) et la pastille
 * desktop en dérivent tous deux — plus de sondes concurrentes.
 *
 * Sondes : `GET /api/health` (backend) puis `GET /api/jellyfin/System/Info/Public`
 * (Jellyfin via proxy). Un 503 Jellyfin = « non configuré » (wizard) et ne
 * bascule PAS hors ligne — sémantique reprise de l'ancien useServerReachable.
 *
 * Le mode hors ligne MANUEL est persisté par appareil dans `localStorage`
 * (même famille de réglages que `tentacle_theme_mode`) : disponible avant
 * toute initialisation de la base locale, et survit au redémarrage.
 */

import {
  applyProbeResult,
  deriveState,
  initialHysteresis,
  type ConnectivityState,
  type HysteresisConfig,
  type HysteresisState,
} from "./connectivityMachine";
import { backendUrl } from "../main";

export type OfflineReason = "backend" | "jellyfin" | null;

export interface ConnectivitySnapshot {
  state: ConnectivityState;
  manual: boolean;
  /** Joignabilité confirmée par l'hystérésis (null = pas encore sondée). */
  reachable: boolean | null;
  /** Cause de la dernière sonde en échec (affichage popover). */
  reason: OfflineReason;
}

export const MANUAL_OFFLINE_STORAGE_KEY = "tentacle_offline_manual";

const PROBE_TIMEOUT_MS = 5_000;
const OFFLINE_PROBE_INTERVAL_MS = 15_000;
const CONFIRM_PROBE_DELAY_MS = 3_000;
const MIN_PROBE_SPACING_MS = 2_000;
const INITIAL_PROBE_DELAY_MS = 1_000;
const HYSTERESIS: HysteresisConfig = { flipThreshold: 2, dwellMs: 10_000 };

const readManual = (): boolean => {
  try {
    return localStorage.getItem(MANUAL_OFFLINE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

let hysteresis: HysteresisState = initialHysteresis;
let manual = readManual();
let reason: OfflineReason = null;

let snapshot: ConnectivitySnapshot = {
  state: deriveState(manual, hysteresis.reachable),
  manual,
  reachable: hysteresis.reachable,
  reason,
};

const listeners = new Set<() => void>();

const rebuildSnapshot = (): void => {
  snapshot = {
    state: deriveState(manual, hysteresis.reachable),
    manual,
    reachable: hysteresis.reachable,
    reason,
  };
  for (const l of listeners) l();
};

let intervalId: ReturnType<typeof setInterval> | null = null;
let confirmId: ReturnType<typeof setTimeout> | null = null;
let probing = false;
let lastProbeStartAt = 0;

/** Sonde périodique active dès qu'on n'est pas « online » (offline auto,
 *  manuel — pour renseigner la joignabilité dans le popover — et checking). */
const ensureTimers = (): void => {
  const needsInterval = snapshot.state !== "online";
  if (needsInterval && intervalId === null) {
    intervalId = setInterval(() => void probe(), OFFLINE_PROBE_INTERVAL_MS);
  } else if (!needsInterval && intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

const scheduleConfirm = (): void => {
  if (confirmId !== null) return;
  confirmId = setTimeout(() => {
    confirmId = null;
    void probe();
  }, CONFIRM_PROBE_DELAY_MS);
};

interface ProbeResult {
  ok: boolean;
  reason: OfflineReason;
}

/** Backend puis Jellyfin (via proxy), timeout commun de 5 s.
 *  NB : `backendUrl` (import circulaire via main.tsx) n'est lu qu'ICI, à
 *  l'exécution — jamais au chargement du module (TDZ). Même patron que
 *  l'ancien useServerReachable. */
async function runProbe(): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const backendRes = await fetch(`${backendUrl}/api/health`, { signal: controller.signal });
    if (!backendRes.ok) return { ok: false, reason: "backend" };
    try {
      const jellyfinRes = await fetch(`${backendUrl}/api/jellyfin/System/Info/Public`, {
        signal: controller.signal,
      });
      // 503 = Jellyfin non configuré (wizard) → ne pas basculer hors ligne.
      if (jellyfinRes.status === 503) return { ok: true, reason: null };
      return jellyfinRes.ok ? { ok: true, reason: null } : { ok: false, reason: "jellyfin" };
    } catch {
      return { ok: false, reason: "jellyfin" };
    }
  } catch {
    return { ok: false, reason: "backend" };
  } finally {
    clearTimeout(timeout);
  }
}

async function probe(): Promise<void> {
  if (probing) return;
  probing = true;
  lastProbeStartAt = Date.now();
  try {
    const result = await runProbe();
    const outcome = applyProbeResult(hysteresis, result.ok, Date.now(), HYSTERESIS);
    hysteresis = outcome.next;
    reason = result.ok ? null : result.reason;
    if (outcome.flipped) {
      rebuildSnapshot();
      ensureTimers();
    }
    if (outcome.wantConfirm) scheduleConfirm();
  } finally {
    probing = false;
  }
}

/** Sonde immédiate. `force` court-circuite l'espacement anti-rafale. */
export function probeNow(force = false): void {
  if (!force && Date.now() - lastProbeStartAt < MIN_PROBE_SPACING_MS) return;
  void probe();
}

/** À appeler quand une requête applicative échoue façon réseau/5xx. */
export function reportPossibleOutage(): void {
  probeNow(false);
}

/** Bascule manuelle (desktop). En sortir relance une sonde immédiate. */
export function setManualOffline(on: boolean): void {
  if (manual === on) return;
  manual = on;
  try {
    if (on) localStorage.setItem(MANUAL_OFFLINE_STORAGE_KEY, "1");
    else localStorage.removeItem(MANUAL_OFFLINE_STORAGE_KEY);
  } catch {
    /* Persistance impossible : le mode vaut pour la session en cours. */
  }
  rebuildSnapshot();
  ensureTimers();
  if (!on) probeNow(true);
}

export const getConnectivitySnapshot = (): ConnectivitySnapshot => snapshot;

export function subscribeConnectivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* Amorçage : sonde initiale différée + réveils sur les signaux navigateur.
 * Module-level (comme colorScheme.ts) — vit toute la durée de l'app. */
if (typeof window !== "undefined") {
  ensureTimers();
  setTimeout(() => probeNow(true), INITIAL_PROBE_DELAY_MS);
  window.addEventListener("online", () => probeNow(true));
  window.addEventListener("offline", () => probeNow(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") probeNow(false);
  });
}
