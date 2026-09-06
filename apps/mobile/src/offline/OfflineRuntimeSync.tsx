import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import { useServerUrl } from "@/providers/ServerUrlContext";
import {
  offlineCreds,
  offlineEngineIfStarted,
  purgeTick,
  startOfflineRuntime,
  updateOfflineCreds,
} from "./engineRuntime";
import { syncAvatarCache } from "./avatarCache";
import { runOnlineCascade } from "./onlineCascade";
import { configureDeviceSettings, setCellularAck, useCellularAck } from "./deviceSettings";
import { isLocalPlaybackActive } from "./nowPlaying";
import { maybeRefreshOfflineCaches, refreshOfflineCaches } from "./prefsCache";
import { syncPlaybackState } from "./resync";
import { photographSession } from "./sessionPhoto";
import { isBackgroundTransfers, useWifiOnly } from "./settings";
import { wifiBlocked } from "./transferGate";
import { useConnectivity } from "./useConnectivity";
import { useStorageReady } from "@/providers/StorageReadyContext";

/** Le jeton rafraîchi par AppProviders arrive un peu après le retour au premier plan. */
const CREDS_RECHECK_MS = 3_000;

/**
 * Branche le moteur hors ligne sur la vie de l'application. Ne rend rien.
 *
 * - Chaque passage en ligne et chaque changement de compte relancent le
 *   moteur (`start` re-normalise la file, répare, purge), repoussent la photo
 *   de session et synchronisent l'état de visionnage dans les deux sens — le moteur d'abord,
 *   avant toute autre requête du retour en ligne. Hors ligne, le moteur
 *   démarre aussi (normalisation, purge), sans rien lancer ni réparer.
 * - Un RETOUR en ligne (pas le premier démarrage) déclenche, après la
 *   resynchronisation, la cascade de rafraîchissement de l'accueil.
 * - Le jeton rafraîchi (401, premier plan) est poussé au moteur sans
 *   re-normaliser.
 * - Le retour au premier plan relance les pauses système et fait un tour de
 *   purge (iOS gèle les minuteurs en arrière-plan).
 * - « Wi-Fi seulement » : les données mobiles mettent tout en pause système
 *   (sauf « continuer en données mobiles »), le Wi-Fi relance.
 */
export function OfflineRuntimeSync() {
  const { serverUrl } = useServerUrl();
  const { storage } = useTentacleConfig();
  const userId = useUserId();
  const { state, networkType, reachable } = useConnectivity();
  const wifiOnly = useWifiOnly();
  const cellularAck = useCellularAck();
  const online = state === "online";
  const token = storage.getItem("tentacle_token");
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const queryClient = useQueryClient();
  // L'état précédent : la cascade ne vaut que pour un retour, pas un démarrage.
  const wasOfflineRef = useRef(false);
  useEffect(() => {
    if (state === "offline-auto" || state === "offline-manual") wasOfflineRef.current = true;
  }, [state]);

  // Après l'hydratation seulement (voir StorageReadyContext).
  const storageReady = useStorageReady();
  useEffect(() => {
    if (!storageReady) return;
    configureDeviceSettings(storage);
  }, [storage, storageReady]);

  useEffect(() => {
    if (!online || !serverUrl || !token || !userId) return;
    startOfflineRuntime({ serverUrl, token });
    photographSession(userId, storage, null);
    syncAvatarCache(userId, serverUrl, token, storage);
    // Le moteur d'abord, puis les caches de langues et le seuil « vu » — la
    // lecture locale n'interroge jamais le serveur, même en ligne.
    const returning = wasOfflineRef.current;
    wasOfflineRef.current = false;
    void syncPlaybackState(serverUrl, token, userId, "all", { force: true }).then(() => {
      if (returning) runOnlineCascade(queryClient);
      return refreshOfflineCaches(serverUrl, token, userId, storage);
    });
    // Le jeton est suivi à part (voir ci-dessous) : un rafraîchissement ne
    // doit pas relancer une normalisation complète.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, serverUrl, userId]);

  // Démarrage hors ligne : le moteur se normalise quand même (transferts
  // interrompus et pauses système remis d'aplomb) et la purge tourne — la
  // politique refuse tout lancement ; le retour en ligne relancera (`start`
  // est réentrant). Sans lui, une ligne figée en « En préparation » le
  // restait toute la session, et rien ne purgeait les échéances.
  useEffect(() => {
    if (online || state === "checking" || !serverUrl || !token || !userId) return;
    if (offlineCreds() !== null) return;
    startOfflineRuntime({ serverUrl, token });
  }, [online, state, serverUrl, token, userId]);

  // Jeton rafraîchi : les transferts suivants l'utilisent.
  useEffect(() => {
    const syncCreds = (): void => {
      const current = offlineCreds();
      const fresh = storage.getItem("tentacle_token");
      if (current !== null && fresh && current.token !== fresh) {
        updateOfflineCreds({ serverUrl: current.serverUrl, token: fresh });
      }
    };
    syncCreds();
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "background") {
        // « Continuer en arrière-plan » désactivé : les transferts ne tournent
        // qu'à l'écran — pause système, relevée au retour au premier plan.
        if (!isBackgroundTransfers()) offlineEngineIfStarted()?.suspendForSystem();
        return;
      }
      if (status !== "active") return;
      offlineEngineIfStarted()?.resumeSystemPauses();
      purgeTick();
      setTimeout(syncCreds, CREDS_RECHECK_MS);
      // Retour au premier plan en ligne : l'état de visionnage repart dans les
      // deux sens (au plus une fois par minute) — jamais pendant une lecture.
      if (state === "online" && serverUrl && token && userId && !isLocalPlaybackActive()) {
        void syncPlaybackState(serverUrl, token, userId, "all");
        void maybeRefreshOfflineCaches(serverUrl, token, userId, storage);
      }
    });
    return () => subscription.remove();
  }, [storage, state, token, serverUrl, userId]);

  // Wi-Fi seulement : pause système en données mobiles — sauf accusé
  // « continuer en données mobiles », qui tombe au retour du Wi-Fi —, reprise
  // au retour du Wi-Fi.
  useEffect(() => {
    if (networkType === "wifi") setCellularAck(false);
    const engine = offlineEngineIfStarted();
    if (engine === null) return;
    if (wifiBlocked({ wifiOnly, networkType, cellularAck })) engine.suspendForSystem();
    else if (reachable === true) engine.resumeSystemPauses();
  }, [wifiOnly, cellularAck, networkType, reachable, online]);

  return null;
}
