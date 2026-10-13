import { useEffect } from "react";
import { acquireSocket, subscribeSocket, useJellyfinClient, useStreamingConfig } from "@tentacle-tv/api-client";
import type { WsServerMessage } from "@tentacle-tv/shared";
import { endProfileSession } from "./profileEnded";
import { useActiveProfile } from "./profileSession";

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
 *   session personnelle retrouvera la sienne au retour (`sessionSwap.ts`).
 *
 * En session personnelle, et partout hors du bureau : rien.
 */
export function ProfileSessionBinding() {
  const profile = useActiveProfile();
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

  const deviceId = data?.deviceId;
  useEffect(() => {
    if (deviceId && deviceId !== client.getDeviceId()) client.adoptJellyfinDeviceId(deviceId);
  }, [client, deviceId]);

  return null;
}
