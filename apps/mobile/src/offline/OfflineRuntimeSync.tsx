import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import { useServerUrl } from "@/providers/ServerUrlContext";
import {
  offlineCreds,
  offlineEngineIfStarted,
  purgeTick,
  startOfflineRuntime,
  updateOfflineCreds,
} from "./engineRuntime";
import { drainReportQueue } from "./resync";
import { photographSession } from "./sessionPhoto";
import { useWifiOnly } from "./settings";
import { useConnectivity } from "./useConnectivity";

/** Le jeton rafraîchi par AppProviders arrive un peu après le retour au premier plan. */
const CREDS_RECHECK_MS = 3_000;

/**
 * Branche le moteur hors ligne sur la vie de l'application. Ne rend rien.
 *
 * - Chaque passage en ligne et chaque changement de compte relancent le
 *   moteur (`start` re-normalise la file, répare, purge), repoussent la photo
 *   de session et vident la file de resynchronisation — le moteur d'abord,
 *   avant toute autre requête du retour en ligne.
 * - Le jeton rafraîchi (401, premier plan) est poussé au moteur sans
 *   re-normaliser.
 * - Le retour au premier plan relance les pauses système et fait un tour de
 *   purge (iOS gèle les minuteurs en arrière-plan).
 * - « Wi-Fi seulement » : les données mobiles mettent tout en pause système,
 *   le Wi-Fi relance.
 */
export function OfflineRuntimeSync() {
  const { serverUrl } = useServerUrl();
  const { storage } = useTentacleConfig();
  const userId = useUserId();
  const { state, networkType, reachable } = useConnectivity();
  const wifiOnly = useWifiOnly();
  const online = state === "online";
  const token = storage.getItem("tentacle_token");
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!online || !serverUrl || !token || !userId) return;
    startOfflineRuntime({ serverUrl, token });
    photographSession(userId, storage, null);
    void drainReportQueue(serverUrl, token, userId);
    // Le jeton est suivi à part (voir ci-dessous) : un rafraîchissement ne
    // doit pas relancer une normalisation complète.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, serverUrl, userId]);

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
      if (status !== "active") return;
      offlineEngineIfStarted()?.resumeSystemPauses();
      purgeTick();
      setTimeout(syncCreds, CREDS_RECHECK_MS);
    });
    return () => subscription.remove();
  }, [storage, state, token]);

  // Wi-Fi seulement : pause système en données mobiles, reprise au retour du Wi-Fi.
  useEffect(() => {
    const engine = offlineEngineIfStarted();
    if (engine === null) return;
    if (wifiOnly && networkType === "cellular") engine.suspendForSystem();
    else if (reachable === true) engine.resumeSystemPauses();
  }, [wifiOnly, networkType, reachable, online]);

  return null;
}
