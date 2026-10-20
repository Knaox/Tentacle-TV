import { useEffect } from "react";
import { acquireSocket, subscribeSocket, useJellyfinClient, useStreamingConfig } from "@tentacle-tv/api-client";
import type { WsServerMessage } from "@tentacle-tv/shared";
import { endProfileSession } from "./profileEnded";
import { useActiveProfile } from "./profileSession";
import { useCrossTabProfileReload } from "./crossTabProfile";
import { useConnectivity } from "../offline/useConnectivity";
import { setManualOffline } from "../offline/connectivityStore";

/**
 * Ce que la SESSION D'UN PROFIL du bureau écoute pendant toute sa vie, sur
 * toutes les pages (lecteur et fiches comprises) — monté par `AppBindings` :
 *
 * - `family:profile-ended` sur la socket : le serveur l'a coupée (profil
 *   retiré, invité supprimé, PIN changé…) → « Qui regarde ? » derrière la
 *   session personnelle (`profileEnded.ts`) ; la fin que pousse une bascule
 *   voulue (« replaced ») est ignorée là-bas ;
 * - l'identité Jellyfin du profil : `/api/config/streaming` la donne (le
 *   canal de session la présente pour lui), comme à une TV jumelée ; la
 *   session personnelle retrouvera la sienne au retour (`sessionSwap.ts`) ;
 * - jamais de hors ligne manuel : rien n'est gardé sur la machine pour lui.
 *
 * En session personnelle : rien, sauf suivre un autre onglet qui change de
 * profil (le navigateur).
 */
export function ProfileSessionBinding() {
  const profile = useActiveProfile();
  // Un autre onglet du navigateur change de profil : celui-ci suit (`crossTabProfile.ts`).
  useCrossTabProfileReload();
  return profile ? <ProfileSessionWatch /> : null;
}

function ProfileSessionWatch() {
  const client = useJellyfinClient();
  const token = client.getAccessToken() || localStorage.getItem("tentacle_token");
  const { data } = useStreamingConfig(token);

  useEffect(() => {
    if (!token) return;
    const release = acquireSocket(token);
    const off = subscribeSocket((message: WsServerMessage) => {
      if (message.type === "family:profile-ended") endProfileSession(message.reason);
    });
    return () => {
      off();
      release();
    };
  }, [token]);

  // Le hors ligne MANUEL n'existe pas pour un profil (rien n'est gardé pour
  // lui) : un choix laissé par la session personnelle ne l'y enferme pas.
  const { manual } = useConnectivity();
  useEffect(() => {
    if (manual) setManualOffline(false);
  }, [manual]);

  const deviceId = data?.deviceId;
  useEffect(() => {
    if (deviceId && deviceId !== client.getDeviceId()) client.adoptJellyfinDeviceId(deviceId);
  }, [client, deviceId]);

  return null;
}
