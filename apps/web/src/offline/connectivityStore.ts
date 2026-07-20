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
  deriveLinkQuality,
  deriveState,
  initialHysteresis,
  LATENCY_HYSTERESIS,
  SLOW_LINK_MS,
  type ConnectivityState,
  type HysteresisConfig,
  type HysteresisState,
  type LinkQuality,
} from "./connectivityMachine";
import { setNetworkSuspectListener } from "@tentacle-tv/api-client";
import { isTauri } from "../hooks/mpvRuntime";
import { backendUrl } from "../main";

export type OfflineReason = "backend" | "jellyfin" | null;

export interface ConnectivitySnapshot {
  state: ConnectivityState;
  manual: boolean;
  /** Joignabilité confirmée par l'hystérésis (null = pas encore sondée). */
  reachable: boolean | null;
  /** Cause de la dernière sonde en échec (affichage popover). */
  reason: OfflineReason;
  /** Qualité du lien mesurée sur la latence des sondes — indépendante de
   *  `state` : on peut être « online » ET lent. Alimente le mode économie. */
  linkQuality: LinkQuality;
}

export const MANUAL_OFFLINE_STORAGE_KEY = "tentacle_offline_manual";

const PROBE_TIMEOUT_MS = 5_000;
const OFFLINE_PROBE_INTERVAL_MS = 15_000;
/** En ligne : sonde LÉGÈRE (health seul) uniquement pour suivre la latence.
 *  Web : très espacée — à ~0,7 Ko l'aller-retour, sonder toutes les 60 s
 *  coûterait ~84 Ko sur 2 h de film ; une vraie panne déclenche de toute façon
 *  une sonde immédiate via `reportPossibleOutage`. Desktop : resserrée à 90 s
 *  — rester faussement « en ligne » masque le catalogue local (pire cas
 *  d'inertie si AUCUNE requête ne circule), coût négligeable sur un poste. */
const ONLINE_PROBE_INTERVAL_WEB_MS = 300_000;
const ONLINE_PROBE_INTERVAL_DESKTOP_MS = 90_000;
const onlineProbeIntervalMs = (): number =>
  isTauri() ? ONLINE_PROBE_INTERVAL_DESKTOP_MS : ONLINE_PROBE_INTERVAL_WEB_MS;
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
/** Hystérésis de la LATENCE — `reachable` y porte « dernière mesure rapide ». */
let latency: HysteresisState = initialHysteresis;
let manual = readManual();
let reason: OfflineReason = null;

const buildSnapshot = (): ConnectivitySnapshot => ({
  state: deriveState(manual, hysteresis.reachable),
  manual,
  reachable: hysteresis.reachable,
  reason,
  linkQuality: deriveLinkQuality(latency.reachable),
});

let snapshot: ConnectivitySnapshot = buildSnapshot();

const listeners = new Set<() => void>();

const rebuildSnapshot = (): void => {
  snapshot = buildSnapshot();
  for (const l of listeners) l();
};

let intervalId: ReturnType<typeof setInterval> | null = null;
let intervalMs = 0;
let confirmId: ReturnType<typeof setTimeout> | null = null;
let probing = false;
let lastProbeStartAt = 0;

/** Sonde périodique TOUJOURS active, à deux cadences :
 *  - hors « online » (offline auto, manuel — pour renseigner la joignabilité
 *    dans le popover — et checking) : 15 s, sonde complète ;
 *  - en « online » : 5 min web / 90 s desktop, sonde légère (latence seule). */
const ensureTimers = (): void => {
  const online = snapshot.state === "online";
  const wanted = online ? onlineProbeIntervalMs() : OFFLINE_PROBE_INTERVAL_MS;
  if (intervalId !== null && intervalMs === wanted) return;
  if (intervalId !== null) clearInterval(intervalId);
  intervalMs = wanted;
  intervalId = setInterval(() => void probe(online), wanted);
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
  /** Latence de `/api/health` en ms — `null` si la sonde a échoué (pas de
   *  mesure exploitable : on gèle alors la dernière qualité connue). */
  latencyMs: number | null;
}

/** Backend puis Jellyfin (via proxy), timeout commun de 5 s.
 *  NB : `backendUrl` (import circulaire via main.tsx) n'est lu qu'ICI, à
 *  l'exécution — jamais au chargement du module (TDZ). Même patron que
 *  l'ancien useServerReachable.
 *
 *  `latencyOnly` : on s'arrête après le backend. La latence suffit à qualifier
 *  le lien, et revérifier Jellyfin toutes les 5 min doublerait le coût pour
 *  rien — une panne Jellyfin se manifeste de toute façon par l'échec d'une
 *  requête applicative, qui déclenche une sonde COMPLÈTE immédiate. */
async function runProbe(latencyOnly: boolean): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const backendRes = await fetch(`${backendUrl}/api/health`, { signal: controller.signal });
    const latencyMs = Date.now() - startedAt;
    if (!backendRes.ok) return { ok: false, reason: "backend", latencyMs: null };
    if (latencyOnly) return { ok: true, reason: null, latencyMs };
    try {
      const jellyfinRes = await fetch(`${backendUrl}/api/jellyfin/System/Info/Public`, {
        signal: controller.signal,
      });
      // 503 = Jellyfin non configuré (wizard) → ne pas basculer hors ligne.
      if (jellyfinRes.status === 503) return { ok: true, reason: null, latencyMs };
      return jellyfinRes.ok
        ? { ok: true, reason: null, latencyMs }
        : { ok: false, reason: "jellyfin", latencyMs };
    } catch {
      return { ok: false, reason: "jellyfin", latencyMs };
    }
  } catch {
    return { ok: false, reason: "backend", latencyMs: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function probe(latencyOnly = false): Promise<void> {
  if (probing) return;
  probing = true;
  lastProbeStartAt = Date.now();
  try {
    const result = await runProbe(latencyOnly);
    const now = Date.now();
    const outcome = applyProbeResult(hysteresis, result.ok, now, HYSTERESIS);
    hysteresis = outcome.next;
    reason = result.ok ? null : result.reason;

    // Qualité du lien : MÊME machine d'hystérésis, dimension indépendante.
    // Sans mesure (sonde en échec) on ne touche à rien — la dernière qualité
    // connue est conservée pour le retour en ligne.
    let qualityFlipped = false;
    if (result.latencyMs !== null) {
      const q = applyProbeResult(latency, result.latencyMs < SLOW_LINK_MS, now, LATENCY_HYSTERESIS);
      latency = q.next;
      qualityFlipped = q.flipped;
    }

    if (outcome.flipped || qualityFlipped) {
      rebuildSnapshot();
      ensureTimers();
    }
    if (outcome.wantConfirm) scheduleConfirm();
  } finally {
    probing = false;
  }
}

/** Sonde immédiate et COMPLÈTE. `force` court-circuite l'anti-rafale. */
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
  // Chaque tentative fetch en échec réseau/timeout (fetchWithRetry) déclenche
  // une sonde — throttlée par MIN_PROBE_SPACING_MS + le drapeau `probing`.
  setNetworkSuspectListener(() => reportPossibleOutage());
  ensureTimers();
  setTimeout(() => probeNow(true), INITIAL_PROBE_DELAY_MS);
  window.addEventListener("online", () => probeNow(true));
  window.addEventListener("offline", () => probeNow(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") probeNow(false);
  });
}
