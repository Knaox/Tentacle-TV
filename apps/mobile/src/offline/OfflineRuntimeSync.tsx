import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient, useServerCapability, useTentacleConfig } from "@tentacle-tv/api-client";
import { offlineOwnerOf } from "@tentacle-tv/offline-core";
import { refreshStoredUser } from "@/auth/storedUser";
import { useServerUrl } from "@/providers/ServerUrlContext";
import {
  offlineCreds,
  offlineEngineIfStarted,
  purgeTick,
  startOfflineRuntime,
  updateOfflineCreds,
} from "./engineRuntime";
import { syncAvatarCache } from "./avatarCache";
import { setTransfersSuspended } from "./backgroundParallel";
import { setServerPrepareEnabled } from "./serverPrepare";
import { publicLog } from "../../modules/offline-storage/publicLog";
import { useOfflinePushWake } from "./offlinePushWake";
import { runOnlineCascade } from "./onlineCascade";
import { configureDeviceSettings, setCellularAck, useCellularAck } from "./deviceSettings";
import { configureEngineSettings } from "@/player/engine/engineSettings";
import { isLocalPlaybackActive } from "./nowPlaying";
import { useOfflineDevHook } from "./offlineDevHook";
import { maybeRefreshOfflineCaches, refreshOfflineCaches } from "./prefsCache";
import { syncPlaybackState } from "./resync";
import { photographSession } from "./sessionPhoto";
import { isBackgroundTransfers, useWifiOnly } from "./settings";
import { wifiBlocked } from "./transferGate";
import { useConnectivity } from "./useConnectivity";
import { useStorageReady } from "@/providers/StorageReadyContext";
import { useOfflineProfileSession } from "./rights/useOfflineOwner";

/** Le jeton rafraîchi par AppProviders arrive un peu après le retour au premier plan. */
const CREDS_RECHECK_MS = 3_000;
/** Au premier plan, le profil (photo, nom, droits) se relit au plus une fois par minute. */
const PROFILE_FOREGROUND_MIN_INTERVAL_MS = 60_000;

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
 * - Le profil (photo, nom, droits) se relit à chaque passage en ligne et, au
 *   plus une fois par minute, au retour au premier plan ; la copie locale de
 *   la photo suit son étiquette.
 * - « Wi-Fi seulement » : les données mobiles mettent tout en pause système
 *   (sauf « continuer en données mobiles »), le Wi-Fi relance.
 *
 * Le hors ligne appartient au COMPTE de l'appareil (`offline-core` ›
 * `offlineOwnerOf`) : le moteur tourne toujours avec SON jeton, même pendant la
 * session d'un profil (un lot lancé par le compte continue en coulisse). Ce qui
 * photographie ou synchronise la session (photo, état de visionnage, caches de
 * langues) attend la session du compte : un profil n'y écrit rien.
 */
export function OfflineRuntimeSync() {
  const { serverUrl } = useServerUrl();
  const { storage } = useTentacleConfig();
  const profileSession = useOfflineProfileSession();
  // Relu à chaque rendu : la bascule d'un profil au compte (et retour) réécrit le stockage.
  const owner = offlineOwnerOf(storage);
  const userId = owner?.userId ?? null;
  const client = useJellyfinClient();
  // Développement : le hors ligne pilotable depuis l'inspecteur (voir le crochet).
  useOfflineDevHook(client, userId);
  // La préparation tenue par le serveur : lue par le moteur à chaque transfert.
  const serverPrepare = useServerCapability("offline.serverPrepare");
  useEffect(() => setServerPrepareEnabled(serverPrepare), [serverPrepare]);
  // L'iPhone réveillé par le serveur quand une préparation s'achève sans lui.
  useOfflinePushWake();
  const { state, networkType, reachable } = useConnectivity();
  const wifiOnly = useWifiOnly();
  const cellularAck = useCellularAck();
  const online = state === "online";
  const token = owner?.token ?? null;
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
    // Les réglages d'appareil du lecteur (moteur vidéo…) : même stockage, même moment.
    configureEngineSettings(storage);
  }, [storage, storageReady]);

  useEffect(() => {
    if (!online || !serverUrl || !token || !userId) return;
    startOfflineRuntime({ serverUrl, token });
    if (profileSession) return;
    photographSession(userId, storage, null);
    // Le profil se relit à chaque passage en ligne, ouverture comprise : une
    // photo changée, ajoutée ou retirée ailleurs n'attend plus la prochaine
    // connexion. La copie locale suit, sur l'étiquette relue.
    void refreshStoredUser(storage, client).finally(() => syncAvatarCache(userId, serverUrl, token, storage));
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
  }, [online, serverUrl, userId, profileSession]);

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
      const fresh = offlineOwnerOf(storage)?.token;
      if (current !== null && fresh && current.token !== fresh) {
        updateOfflineCreds({ serverUrl: current.serverUrl, token: fresh });
      }
    };
    syncCreds();
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "background") {
        // « Continuer en arrière-plan » désactivé : les transferts ne tournent
        // qu'à l'écran — pause système, relevée au retour au premier plan.
        if (!isBackgroundTransfers()) {
          offlineEngineIfStarted()?.suspendForSystem();
          return;
        }
        // Activé, sur iOS : le JavaScript va être suspendu et ne lancera plus
        // rien. On remet au système tout ce qu'on peut MAINTENANT — il mènera
        // ces transferts à leur terme sans nous. Sans ça, la file s'arrêtait
        // au premier épisode achevé.
        setTransfersSuspended(true);
        const engine = offlineEngineIfStarted();
        engine?.pump();
        if (engine !== null && engine.pending() > 0) publicLog("hors-ligne-fond", `app derrière : ${engine.pending()} transfert(s) en cours ou en file`);
        return;
      }
      if (status !== "active") return;
      setTransfersSuspended(false);
      offlineEngineIfStarted()?.resumeSystemPauses();
      // Le système gèle les minuteurs en arrière-plan : les relances dont
      // l'échéance est passée pendant ce temps se rattrapent ici.
      offlineEngineIfStarted()?.sweepRetries();
      purgeTick();
      setTimeout(syncCreds, CREDS_RECHECK_MS);
      // Retour au premier plan en ligne : l'état de visionnage repart dans les
      // deux sens (au plus une fois par minute) — jamais pendant une lecture.
      if (state === "online" && serverUrl && token && userId && !profileSession && !isLocalPlaybackActive()) {
        void syncPlaybackState(serverUrl, token, userId, "all");
        void maybeRefreshOfflineCaches(serverUrl, token, userId, storage);
        // Une photo changée ailleurs pendant l'absence : l'app revenue au
        // premier plan la montre, et la copie locale ne se refait que si
        // l'étiquette a bougé.
        void refreshStoredUser(storage, client, { minIntervalMs: PROFILE_FOREGROUND_MIN_INTERVAL_MS }).then((photoChanged) => {
          if (photoChanged) syncAvatarCache(userId, serverUrl, token, storage);
        });
      }
    });
    return () => subscription.remove();
  }, [storage, state, token, serverUrl, userId, client, profileSession]);

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
