/**
 * Persistance LOCALE de la progression pendant une lecture locale :
 * - toutes les 10 s + au démontage : position/état « vu » (seuil 92 %) en
 *   SQLite, par utilisateur ; hors ligne, l'événement rejoint la file de
 *   resynchronisation Jellyfin (drainée au retour en ligne) ;
 * - « supprimer après visionnage » : au démontage, si le seuil est atteint et
 *   que l'option est active sur le claim, le téléchargement de CE compte est
 *   retiré (le fichier ne part du disque qu'au dernier claim).
 */

import { useEffect, useRef } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import { deleteDownload } from "../downloads/api";
import { saveLocalPlaybackState, type LocalSource } from "../downloads/playbackApi";
import { useConnectivity } from "../offline/useConnectivity";

const SAVE_INTERVAL_MS = 10_000;
export const WATCHED_THRESHOLD_PCT = 92;

interface LocalReportingParams {
  enabled: boolean;
  itemId: string | undefined;
  localSource: LocalSource | null;
  /** Position courante en secondes (ref partagée avec le lecteur). */
  positionRef: React.MutableRefObject<number>;
  durationSeconds: number | undefined;
}

export function useLocalPlaybackReporting({
  enabled,
  itemId,
  localSource,
  positionRef,
  durationSeconds,
}: LocalReportingParams): void {
  const userId = useUserId();
  const { state } = useConnectivity();
  const onlineRef = useRef(true);
  onlineRef.current = state === "online" || state === "checking";
  const durationRef = useRef(durationSeconds);
  durationRef.current = durationSeconds;

  useEffect(() => {
    if (!enabled || !userId || !itemId || !localSource) return;
    const fileId = localSource.fileId;
    const autoDelete = localSource.autoDeleteAfterWatch;

    const snapshot = () => {
      const seconds = positionRef.current;
      const duration = durationRef.current ?? 0;
      const pct = duration > 0 ? (seconds / duration) * 100 : 0;
      return {
        ticks: Math.max(0, Math.floor(seconds * TICKS_PER_SECOND)),
        played: pct >= WATCHED_THRESHOLD_PCT,
      };
    };

    const persist = () => {
      const { ticks, played } = snapshot();
      if (ticks <= 0 && !played) return;
      void saveLocalPlaybackState(userId, itemId, ticks, played, !onlineRef.current);
    };

    const interval = setInterval(persist, SAVE_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      const { ticks, played } = snapshot();
      if (ticks > 0 || played) {
        void saveLocalPlaybackState(userId, itemId, ticks, played, !onlineRef.current);
      }
      if (autoDelete && played) {
        void deleteDownload(userId, fileId);
      }
    };
  }, [enabled, userId, itemId, localSource, positionRef]);
}
