/**
 * Résilience du reporting quand l'onglet passe en arrière-plan ou se ferme —
 * extrait de `usePlayback` pour tenir la limite de 300 lignes par fichier.
 *
 * Chrome gèle/étrangle `setInterval` dans un onglet caché après ~5 min. Au
 * passage en arrière-plan on bascule donc sur `sendBeacon` (fire-and-forget,
 * survit à l'étranglement), et on restaure l'intervalle normal au retour.
 *
 * `beforeunload` envoie un `/Sessions/Playing/Stopped` par beacon : c'est LE
 * filet qui sauve la position quand l'application est fermée en pleine lecture.
 */

import { useEffect, type MutableRefObject } from "react";
import type { JellyfinClient } from "../jellyfin";
import { beaconUrl, killActiveEncoding, safePositionTicks } from "./playbackTransport";

export interface PlaybackBeaconRefs {
  client: MutableRefObject<JellyfinClient>;
  itemId: MutableRefObject<string | undefined>;
  mediaSourceId: MutableRefObject<string | undefined>;
  playSessionId: MutableRefObject<string | undefined>;
  audioStreamIndex: MutableRefObject<number>;
  subtitleStreamIndex: MutableRefObject<number | null>;
  playMethod: MutableRefObject<string>;
  position: MutableRefObject<number>;
  paused: MutableRefObject<boolean>;
  started: MutableRefObject<boolean>;
  interval: MutableRefObject<ReturnType<typeof setInterval> | null>;
  bgInterval: MutableRefObject<ReturnType<typeof setInterval> | null>;
  bgMode: MutableRefObject<boolean>;
  /** Reporting « bords » : aucun battement, même en arrière-plan. */
  edgesOnly: MutableRefObject<boolean>;
  /** Toujours lu via un ref : l'effet est monté une seule fois (deps vides). */
  resetInterval: MutableRefObject<() => void>;
}

export interface PlaybackBeaconOptions {
  refs: PlaybackBeaconRefs;
  reportIntervalMs: number;
  clearProgressInterval: () => void;
}

export function usePlaybackBeacons({
  refs,
  reportIntervalMs,
  clearProgressInterval,
}: PlaybackBeaconOptions): void {
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;

    const post = (path: string, body: unknown) => {
      const url = beaconUrl(refs.client.current, path);
      const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
      if (typeof navigator.sendBeacon === "function") navigator.sendBeacon(url, blob);
    };

    const sendProgressBeacon = () => {
      if (!refs.itemId.current || !refs.started.current) return;
      post("/Sessions/Playing/Progress", {
        ItemId: refs.itemId.current,
        MediaSourceId: refs.mediaSourceId.current ?? refs.itemId.current,
        PlaySessionId: refs.playSessionId.current ?? undefined,
        PositionTicks: safePositionTicks(refs.position.current),
        IsPaused: refs.paused.current,
        CanSeek: true,
        PlayMethod: refs.playMethod.current,
        AudioStreamIndex: refs.audioStreamIndex.current,
        SubtitleStreamIndex: refs.subtitleStreamIndex.current ?? -1,
      });
    };

    const startBgBeaconInterval = () => {
      if (refs.bgInterval.current) clearInterval(refs.bgInterval.current);
      // Mode « bords » : pas de battement en arrière-plan non plus. C'était un
      // SECOND heartbeat, invisible dans l'onglet Network et donc facile à
      // oublier — il aurait annulé tout le bénéfice dans le cas le plus
      // courant, la fenêtre réduite pendant un film.
      if (refs.edgesOnly.current) return;
      refs.bgInterval.current = setInterval(sendProgressBeacon, reportIntervalMs);
    };

    const onBeforeUnload = () => {
      if (!refs.itemId.current || !refs.started.current) return;
      clearProgressInterval();
      refs.started.current = false;
      killActiveEncoding(refs.client.current, refs.playSessionId.current, true);
      // Envoyé même en mode « bords » : c'est un message de fin, pas un
      // battement — et c'est ce qui sauve la position à la fermeture.
      post("/Sessions/Playing/Stopped", {
        ItemId: refs.itemId.current,
        MediaSourceId: refs.mediaSourceId.current ?? refs.itemId.current,
        PlaySessionId: refs.playSessionId.current ?? undefined,
        PositionTicks: safePositionTicks(refs.position.current),
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (!refs.itemId.current || !refs.started.current) return;
        // Onglet → arrière-plan : on tue l'intervalle fetch (qui serait gelé)
        // et on bascule sur le beacon.
        if (refs.interval.current) {
          clearInterval(refs.interval.current);
          refs.interval.current = null;
        }
        refs.bgMode.current = true;
        sendProgressBeacon();
        startBgBeaconInterval();
      } else {
        // Onglet → premier plan : on restaure le reporting fetch normal.
        // `clearProgressInterval` gère les deux intervalles + remet bgMode.
        clearProgressInterval();
        if (refs.itemId.current && refs.started.current) {
          sendProgressBeacon(); // rattrapage immédiat
        }
        refs.resetInterval.current();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
