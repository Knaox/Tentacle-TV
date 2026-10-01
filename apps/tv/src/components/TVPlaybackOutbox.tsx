import { useEffect } from "react";
import { AppState, InteractionManager } from "react-native";
import {
  configurePlaybackOutbox, flushPlaybackOutboxFor, onSocketStatus, useJellyfinClient,
  type OutboxOwner, type StorageAdapter,
} from "@tentacle-tv/api-client";
import { useStoredToken } from "../hooks/useStoredToken";
import { plog } from "../utils/playerDiag";

/** Au retour au premier plan, le lecteur rouvre d'abord sa session : on la laisse passer. */
const FOREGROUND_FLUSH_DELAY_MS = 1_500;

/** Le compte et l'appareil de la session courante ; `null` sans session. */
function ownerOf(storage: StorageAdapter, deviceId: string): OutboxOwner | null {
  if (!storage.getItem("tentacle_token")) return null;
  try {
    const user = JSON.parse(storage.getItem("tentacle_user") ?? "null") as { Id?: string } | null;
    return user?.Id ? { userId: user.Id, deviceId } : null;
  } catch {
    return null;
  }
}

/**
 * La file PERSISTÉE des rapports de lecture, côté téléviseur (api-client,
 * `playbackOutbox`) : configurée sur le stockage de l'appareil et la session
 * courante, vidée au démarrage, au retour au premier plan et au retour du
 * réseau (socket rouvert). Un arrêt raté — app suspendue, tuée, serveur muet —
 * part ainsi dès que possible, et seulement s'il n'est pas périmé.
 */
export function TVPlaybackOutbox({ storage }: { storage: StorageAdapter }) {
  const client = useJellyfinClient();
  const token = useStoredToken(storage);

  useEffect(() => {
    configurePlaybackOutbox(storage, () => ownerOf(storage, client.getDeviceId()));
    return () => configurePlaybackOutbox(null, () => null);
  }, [storage, client]);

  useEffect(() => {
    if (!token) return;
    const flush = (why: string) => {
      const owner = ownerOf(storage, client.getDeviceId());
      if (!owner) return;
      void flushPlaybackOutboxFor(client, owner.userId).then((r) => {
        if (r.sent || r.dropped || r.kept) plog("outbox", `vidage (${why}) : ${r.sent} envoyé(s), ${r.dropped} jeté(s), ${r.kept} gardé(s)`);
      });
    };
    const startup = InteractionManager.runAfterInteractions(() => flush("démarrage"));
    let timer: ReturnType<typeof setTimeout> | null = null;
    let previousApp = AppState.currentState;
    const appSub = AppState.addEventListener("change", (state) => {
      const back = state === "active" && previousApp === "background";
      previousApp = state;
      if (!back) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => flush("retour"), FOREGROUND_FLUSH_DELAY_MS);
    });
    let previousSocket: string | null = null;
    const offSocket = onSocketStatus((status) => {
      if (status === "open" && previousSocket !== null && previousSocket !== "open") flush("réseau");
      previousSocket = status;
    });
    return () => {
      startup.cancel();
      appSub.remove();
      offSocket();
      if (timer) clearTimeout(timer);
    };
  }, [token, storage, client]);

  return null;
}
