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
import { localReportMode, useUserId } from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import { deleteDownload } from "../downloads/api";
import {
  clearReportQueueForItem,
  saveLocalPlaybackState,
  type LocalSource,
} from "../downloads/playbackApi";
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
  /** Promesse du dernier `/Sessions/Playing/Stopped` — sert à ne purger la
   *  file de resynchronisation qu'une fois la position confirmée côté serveur. */
  stopPromiseRef?: React.MutableRefObject<Promise<void>>;
}

export function useLocalPlaybackReporting({
  enabled,
  itemId,
  localSource,
  positionRef,
  durationSeconds,
  stopPromiseRef,
}: LocalReportingParams): void {
  const userId = useUserId();
  const { state } = useConnectivity();
  const onlineRef = useRef(true);
  onlineRef.current = state === "online" || state === "checking";
  const durationRef = useRef(durationSeconds);
  durationRef.current = durationSeconds;

  /**
   * La file de resynchronisation est alimentée quand la position ne peut PAS
   * partir vers Jellyfin en continu :
   *  - hors ligne (comportement historique) ;
   *  - en mode « bords », où le heartbeat est coupé — c'est là le filet
   *    anti-crash : si l'app meurt sans `Stopped`, la position écrite en SQLite
   *    toutes les 10 s remonte au lancement suivant.
   * Tout est lu à l'appel (ref + état du socle), donc jamais périmé même
   * capturé dans une closure d'effet.
   */
  const shouldQueue = () => !onlineRef.current || localReportMode() === "edges";

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
      void saveLocalPlaybackState(userId, itemId, ticks, played, shouldQueue());
    };

    const interval = setInterval(persist, SAVE_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      const { ticks, played } = snapshot();
      const queued = shouldQueue();
      if (ticks > 0 || played) {
        void saveLocalPlaybackState(userId, itemId, ticks, played, queued);
      }
      if (autoDelete && played) {
        void deleteDownload(userId, fileId);
      }
      // Fermeture propre EN LIGNE : le `/Sessions/Playing/Stopped` a porté la
      // position à Jellyfin, l'entrée de file ferait doublon — et serait
      // rejouée au prochain lancement, écrasant une progression faite
      // entre-temps sur un autre appareil. On la purge, mais SEULEMENT si le
      // Stopped a réussi ; sinon elle reste, c'est tout l'intérêt du filet.
      // Déféré d'un microtask comme dans WatchDesktop : les cleanups React
      // tournent en ordre inverse, le vrai stop promise n'est pas encore
      // assigné à cet instant.
      if (queued && onlineRef.current && stopPromiseRef) {
        queueMicrotask(() => {
          stopPromiseRef.current.then(
            () => void clearReportQueueForItem(userId, itemId),
            () => {
              /* Stopped en échec — la file est conservée et sera drainée */
            },
          );
        });
      }
    };
  }, [enabled, userId, itemId, localSource, positionRef, stopPromiseRef]);
}
