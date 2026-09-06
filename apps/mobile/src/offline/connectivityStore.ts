/**
 * Magasin de connectivité du mobile — LE sondeur de l'application.
 *
 * Même machine que le bureau (`connectivityMachine` du cœur hors ligne) :
 * deux sondes — `GET /api/health` puis `GET /api/jellyfin/System/Info/Public` —,
 * une hystérésis de deux résultats et dix secondes de séjour au retour, quatre
 * états (`checking`, `online`, `offline-auto`, `offline-manual`), et la
 * qualité du lien mesurée sur la latence pour le mode économie. En plus, le
 * réseau du téléphone (Wi-Fi, données mobiles, rien), qui déclenche une sonde
 * à chaque changement et sert à « Wi-Fi seulement ».
 *
 * Module SANS effet au chargement : rien ne part avant que
 * `configureConnectivity` ait reçu l'URL du serveur et le stockage — sur les
 * écrans de connexion, il n'y a rien à sonder.
 */

import { AppState, type AppStateStatus } from "react-native";
import {
  applyLinkLost,
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
} from "@tentacle-tv/offline-core";
import {
  setNetworkSuspectListener,
  setOfflineHintSupplier,
  setRequestTimeoutMs,
  type StorageAdapter,
} from "@tentacle-tv/api-client";

interface NetworkState {
  type?: string;
  isConnected?: boolean;
}

interface NetworkModule {
  getNetworkStateAsync(): Promise<NetworkState>;
  addNetworkStateListener(listener: (state: NetworkState) => void): { remove(): void };
}

// Module natif optionnel, chargé en `require` protégé (patron haptique /
// SecureStore) : sans lui, tout marche sauf la sonde sur changement de réseau.
let Network: NetworkModule | null = null;
try {
  Network = require("expo-network");
} catch {
  Network = null;
}

export type OfflineReason = "backend" | "jellyfin" | null;

export type NetworkType = "wifi" | "cellular" | "none" | "other" | "unknown";

export interface ConnectivitySnapshot {
  state: ConnectivityState;
  manual: boolean;
  /** Joignabilité CONFIRMÉE par l'hystérésis (`null` = jamais sondée). */
  reachable: boolean | null;
  /** Cause de la dernière sonde en échec (la bulle l'affiche). */
  reason: OfflineReason;
  /** Qualité du lien, indépendante de `state` : on peut être en ligne ET lent. */
  linkQuality: LinkQuality;
  /** Le réseau du téléphone, d'après expo-network. */
  networkType: NetworkType;
}

/** Même clé que le web : un réglage d'appareil, comme le thème. */
export const MANUAL_OFFLINE_STORAGE_KEY = "tentacle_offline_manual";

const PROBE_TIMEOUT_MS = 5_000;
/** Hors « online » : sonde complète, comme le bureau. */
const OFFLINE_PROBE_INTERVAL_MS = 15_000;
/** En ligne : sonde complète elle aussi (une panne de Jellyfin seul se voit
 *  ainsi en moins de deux minutes au repos), à la cadence du bureau. */
const ONLINE_PROBE_INTERVAL_MS = 90_000;
/** Un relais Wi-Fi ↔ cellulaire produit un « aucun réseau » transitoire :
 *  on laisse ce délai avant de basculer sur un évènement du listener. */
const LINK_LOST_GRACE_MS = 1_500;
const CONFIRM_PROBE_DELAY_MS = 3_000;
const MIN_PROBE_SPACING_MS = 2_000;
const INITIAL_PROBE_DELAY_MS = 1_000;
const HYSTERESIS: HysteresisConfig = { flipThreshold: 2, dwellMs: 10_000 };
/** Un poste ou un téléphone avec un catalogue local préfère échouer vite. */
const REQUEST_TIMEOUT_MS = 12_000;

let serverUrl: string | null = null;
let storage: StorageAdapter | null = null;
let hooksInstalled = false;

let hysteresis: HysteresisState = initialHysteresis;
/** Hystérésis de la LATENCE — `reachable` y porte « dernière mesure rapide ». */
let latency: HysteresisState = initialHysteresis;
let manual = false;
let reason: OfflineReason = null;
let networkType: NetworkType = "unknown";

const buildSnapshot = (): ConnectivitySnapshot => ({
  state: deriveState(manual, hysteresis.reachable),
  manual,
  reachable: hysteresis.reachable,
  reason,
  linkQuality: deriveLinkQuality(latency.reachable),
  networkType,
});

let snapshot: ConnectivitySnapshot = buildSnapshot();
const listeners = new Set<() => void>();

const rebuildSnapshot = (): void => {
  snapshot = buildSnapshot();
  for (const listener of listeners) listener();
};

let intervalId: ReturnType<typeof setInterval> | null = null;
let intervalMs = 0;
let confirmId: ReturnType<typeof setTimeout> | null = null;
let probing = false;
let lastProbeStartAt = 0;

const stopTimers = (): void => {
  if (intervalId !== null) clearInterval(intervalId);
  intervalId = null;
  intervalMs = 0;
  if (confirmId !== null) clearTimeout(confirmId);
  confirmId = null;
};

/** Sonde périodique toujours active tant qu'un serveur est connu, à deux cadences. */
const ensureTimers = (): void => {
  if (serverUrl === null) {
    stopTimers();
    return;
  }
  const online = snapshot.state === "online";
  const wanted = online ? ONLINE_PROBE_INTERVAL_MS : OFFLINE_PROBE_INTERVAL_MS;
  if (intervalId !== null && intervalMs === wanted) return;
  if (intervalId !== null) clearInterval(intervalId);
  intervalMs = wanted;
  intervalId = setInterval(() => void probe(), wanted);
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
  /** Latence de `/api/health` en ms — `null` si la sonde a échoué. */
  latencyMs: number | null;
}

/** Backend puis Jellyfin (via proxy), délai commun de 5 s. */
async function runProbe(base: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const backendRes = await fetch(`${base}/api/health`, { signal: controller.signal });
    const latencyMs = Date.now() - startedAt;
    if (!backendRes.ok) return { ok: false, reason: "backend", latencyMs: null };
    try {
      const jellyfinRes = await fetch(`${base}/api/jellyfin/System/Info/Public`, {
        signal: controller.signal,
      });
      // 503 = Jellyfin non configuré (assistant) → ne bascule PAS hors ligne.
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

async function probe(): Promise<void> {
  const base = serverUrl;
  if (base === null || probing) return;
  probing = true;
  lastProbeStartAt = Date.now();
  try {
    const result = await runProbe(base);
    const now = Date.now();
    const outcome = applyProbeResult(hysteresis, result.ok, now, HYSTERESIS);
    hysteresis = outcome.next;
    reason = result.ok ? null : result.reason;

    // Qualité du lien : même machine, dimension indépendante ; sans mesure
    // (sonde en échec) on garde la dernière qualité connue.
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

/** Sonde immédiate et complète ; `force` court-circuite l'anti-rafale (2 s). */
export function probeNow(force = false): Promise<void> {
  if (!force && Date.now() - lastProbeStartAt < MIN_PROBE_SPACING_MS) return Promise.resolve();
  return probe();
}

/** Requête applicative en échec réseau / 5xx / délai : sonde, throttlée. */
export function reportPossibleOutage(): void {
  void probeNow(false);
}

export function isOfflineMode(): boolean {
  return snapshot.state === "offline-auto" || snapshot.state === "offline-manual";
}

let linkLostTimer: ReturnType<typeof setTimeout> | null = null;

/** Le téléphone n'a plus aucun réseau (un `UNKNOWN` n'est jamais une bascule). */
function isLinkLost(state: NetworkState): boolean {
  return state.isConnected === false && (state.type ?? "").toUpperCase() === "NONE";
}

/** Bascule hors ligne sans attendre deux sondes ; le retour garde son anti-rebond. */
function linkLost(): void {
  const outcome = applyLinkLost(hysteresis, Date.now());
  if (!outcome.flipped) return;
  hysteresis = outcome.next;
  reason = "backend";
  rebuildSnapshot();
  ensureTimers();
}

function cancelLinkLost(): void {
  if (linkLostTimer !== null) clearTimeout(linkLostTimer);
  linkLostTimer = null;
}

function mapNetworkType(state: NetworkState): NetworkType {
  if (state.isConnected === false) return "none";
  switch ((state.type ?? "").toUpperCase()) {
    case "WIFI":
      return "wifi";
    case "CELLULAR":
      return "cellular";
    case "NONE":
      return "none";
    case "UNKNOWN":
    case "":
      return "unknown";
    default:
      return "other";
  }
}

/**
 * À appeler à chaque changement d'URL de serveur ou de stockage hydraté. Un
 * serveur `null` (écrans d'authentification) arrête les sondes.
 */
export function configureConnectivity(options: { serverUrl: string | null; storage: StorageAdapter }): void {
  storage = options.storage;
  manual = storage.getItem(MANUAL_OFFLINE_STORAGE_KEY) === "1";
  if (!hooksInstalled) {
    hooksInstalled = true;
    setRequestTimeoutMs(REQUEST_TIMEOUT_MS);
    setNetworkSuspectListener(() => reportPossibleOutage());
    // Une bascule confirmée coupe les échelles de réessai déjà en vol.
    setOfflineHintSupplier(isOfflineMode);
  }
  if (serverUrl !== options.serverUrl) {
    serverUrl = options.serverUrl;
    hysteresis = initialHysteresis;
    latency = initialHysteresis;
    reason = null;
    // Réseau déjà connu comme absent : hors ligne dès le premier rendu, plutôt
    // qu'un accueil serveur qui tire ses requêtes pour rien le temps d'une sonde.
    if (networkType === "none" && serverUrl !== null) {
      hysteresis = applyLinkLost(initialHysteresis, Date.now()).next;
      reason = "backend";
    }
  }
  rebuildSnapshot();
  ensureTimers();
  if (serverUrl !== null) setTimeout(() => void probeNow(true), INITIAL_PROBE_DELAY_MS);
}

/** Retour au premier plan et changements de réseau → sondes. Rend le nettoyage. */
export function startConnectivityListeners(): () => void {
  const appState = AppState.addEventListener("change", (status: AppStateStatus) => {
    if (status === "active") void probeNow(false);
  });
  let network: { remove(): void } | null = null;
  // Sans réponse d'expo-network, le réseau vaut « autre » plutôt que
  // « inconnu » : « inconnu » retient les transferts sous Wi-Fi seulement.
  const settle = (next: NetworkType): void => {
    if (next === networkType) return;
    networkType = next;
    rebuildSnapshot();
  };
  if (Network !== null) {
    const apply = (state: NetworkState, fromListener: boolean): void => {
      settle(mapNetworkType(state));
      if (isLinkLost(state)) {
        // Lecture initiale : vérité immédiate. Évènement : le délai de grâce
        // absorbe le « aucun réseau » d'un relais Wi-Fi ↔ cellulaire.
        if (!fromListener) linkLost();
        else if (linkLostTimer === null) {
          linkLostTimer = setTimeout(() => {
            linkLostTimer = null;
            linkLost();
          }, LINK_LOST_GRACE_MS);
        }
        return;
      }
      cancelLinkLost();
      if (fromListener) void probeNow(true);
    };
    Network.getNetworkStateAsync()
      .then((state) => apply(state, false))
      .catch(() => settle("other"));
    network = Network.addNetworkStateListener((state) => apply(state, true));
  } else {
    settle("other");
  }
  return () => {
    appState.remove();
    network?.remove();
    cancelLinkLost();
  };
}

/** Mode manuel, persistant par appareil. En sortir relance une sonde forcée. */
export function setManualOffline(on: boolean): void {
  if (manual === on) return;
  manual = on;
  if (on) storage?.setItem(MANUAL_OFFLINE_STORAGE_KEY, "1");
  else storage?.removeItem(MANUAL_OFFLINE_STORAGE_KEY);
  rebuildSnapshot();
  ensureTimers();
  if (!on) void probeNow(true);
}

export const getConnectivitySnapshot = (): ConnectivitySnapshot => snapshot;

export function subscribeConnectivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
