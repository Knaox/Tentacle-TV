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

import { runProbe, type OfflineReason } from "./connectivityProbe";
import { startNetworkListeners } from "./connectivityListeners";
import { type NetworkType } from "./networkState";
import { isLocalPlaybackActive } from "./nowPlaying";
import {
  applyLinkLost,
  applyProbe,
  deriveLinkQuality,
  deriveState,
  initialConnectivityCore,
  initialHysteresis,
  type ConnectivityCore,
  type ConnectivityState,
  type HysteresisConfig,
  type LinkQuality,
} from "@tentacle-tv/offline-core";
import {
  setNetworkSuspectListener,
  setOfflineHintSupplier,
  setRequestTimeoutMs,
  type StorageAdapter,
} from "@tentacle-tv/api-client";

export type { OfflineReason } from "./connectivityProbe";
export type { NetworkType } from "./networkState";
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

/** Joignabilité, latence et cause — composées par le réducteur du cœur. */
let core: ConnectivityCore = initialConnectivityCore;
let manual = false;
let networkType: NetworkType = "unknown";

const buildSnapshot = (): ConnectivitySnapshot => ({
  state: deriveState(manual, core.hysteresis.reachable),
  manual,
  reachable: core.hysteresis.reachable,
  reason: core.reason,
  linkQuality: deriveLinkQuality(core.latency.reachable),
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
  intervalId = setInterval(() => {
    // Une lecture locale ne doit rien devoir au réseau, pas même la sonde :
    // une panne lui est indifférente, l'arrêt et le premier plan re-sonderont.
    if (isLocalPlaybackActive()) return;
    void probe();
  }, wanted);
};

const scheduleConfirm = (): void => {
  if (confirmId !== null) return;
  confirmId = setTimeout(() => {
    confirmId = null;
    void probe();
  }, CONFIRM_PROBE_DELAY_MS);
};

async function probe(): Promise<void> {
  const base = serverUrl;
  if (base === null || probing) return;
  probing = true;
  lastProbeStartAt = Date.now();
  try {
    const result = await runProbe(base);
    // Sans réseau côté appareil, un échec n'accuse pas le serveur (réducteur du cœur).
    const applied = applyProbe(core, result, Date.now(), HYSTERESIS, networkType === "none");
    core = applied.next;
    if (applied.changed) {
      rebuildSnapshot();
      ensureTimers();
    }
    if (applied.wantConfirm) scheduleConfirm();
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

/** Bascule hors ligne sans attendre deux sondes ; le retour garde son anti-rebond. */
function linkLost(): void {
  const outcome = applyLinkLost(core.hysteresis, Date.now());
  if (!outcome.flipped) return;
  // Rien n'a été sondé : dire « le serveur ne répond pas » serait faux, et
  // enverrait l'utilisateur chercher une panne côté serveur.
  core = { ...core, hysteresis: outcome.next, reason: "network" };
  rebuildSnapshot();
  ensureTimers();
}

function cancelLinkLost(): void {
  if (linkLostTimer !== null) clearTimeout(linkLostTimer);
  linkLostTimer = null;
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
    core = initialConnectivityCore;
    // Réseau déjà connu comme absent : hors ligne dès le premier rendu, plutôt
    // qu'un accueil serveur qui tire ses requêtes pour rien le temps d'une sonde.
    if (networkType === "none" && serverUrl !== null) {
      core = { ...core, hysteresis: applyLinkLost(initialHysteresis, Date.now()).next, reason: "network" };
    }
  }
  rebuildSnapshot();
  ensureTimers();
  if (serverUrl !== null) setTimeout(() => void probeNow(true), INITIAL_PROBE_DELAY_MS);
}

/** Retour au premier plan et changements de réseau → sondes. Rend le nettoyage. */
export function startConnectivityListeners(): () => void {
  const settle = (next: NetworkType): void => {
    if (next === networkType) return;
    networkType = next;
    rebuildSnapshot();
  };
  const stop = startNetworkListeners({
    onType: settle,
    onLinkLost: (graced) => {
      if (!graced) {
        linkLost();
        return;
      }
      if (linkLostTimer !== null) return;
      linkLostTimer = setTimeout(() => {
        linkLostTimer = null;
        linkLost();
      }, LINK_LOST_GRACE_MS);
    },
    onLinkBack: cancelLinkLost,
    onNetworkChange: () => void probeNow(true),
    onForeground: () => void probeNow(false),
  });
  return () => {
    stop();
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
