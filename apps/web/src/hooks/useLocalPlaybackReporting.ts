/**
 * Persistance LOCALE de la progression pendant une lecture locale :
 * - toutes les 10 s + au démontage : position/état « vu » (seuil = MaxResumePct
 *   de Jellyfin, cf. localPlaybackProgress) en SQLite, par utilisateur, TOUJOURS
 *   doublée dans la file de resynchronisation Jellyfin — en lecture locale il n'y
 *   a plus AUCUN reporting live (zéro bande passante), la file est donc l'unique
 *   porteuse de la position ;
 * - au démontage : si l'app est en ligne, la file est drainée immédiatement
 *   (un unique POST par item — Jellyfin à jour dès la sortie du lecteur) ;
 *   sinon elle sera drainée au retour en ligne (ConnectivityBinding) ;
 * - « supprimer après visionnage » : au démontage, si le seuil est atteint et
 *   que l'option est active sur le claim, le téléchargement de CE compte est
 *   retiré (le fichier ne part du disque qu'au dernier claim).
 */

import { useEffect, useRef } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { purgeDueDownloads } from "../downloads/api";
import { saveLocalPlaybackState, type LocalSource } from "../downloads/playbackApi";
import { drainReportQueue } from "../offline/resync";
import { useConnectivity } from "../offline/useConnectivity";
import { etatLectureLocale } from "./localPlaybackProgress";

const SAVE_INTERVAL_MS = 10_000;

interface LocalReportingParams {
  enabled: boolean;
  itemId: string | undefined;
  localSource: LocalSource | null;
  /** Position courante en secondes (ref partagée avec le lecteur). */
  positionRef: React.MutableRefObject<number>;
  durationSeconds: number | undefined;
  /**
   * Seuil du « vu » = MaxResumePct de Jellyfin, celui-là même qui déclenche la
   * bannière « épisode suivant ». Il est relu à chaque enregistrement : un
   * changement côté serveur s'applique en cours de lecture, comme en ligne.
   */
  maxResumePct: number;
  /** Reçoit la promesse « save final + drain » : WatchDesktop y chaîne son
   *  invalidation de fin de lecture (état « vu » frais côté Jellyfin). */
  stopPromiseRef?: React.MutableRefObject<Promise<void>>;
}

export function useLocalPlaybackReporting({
  enabled,
  itemId,
  localSource,
  positionRef,
  durationSeconds,
  maxResumePct,
  stopPromiseRef,
}: LocalReportingParams): void {
  const userId = useUserId();
  const { state } = useConnectivity();
  const onlineRef = useRef(true);
  onlineRef.current = state === "online" || state === "checking";
  const durationRef = useRef(durationSeconds);
  durationRef.current = durationSeconds;
  const seuilRef = useRef(maxResumePct);
  seuilRef.current = maxResumePct;

  useEffect(() => {
    if (!enabled || !userId || !itemId || !localSource) return;
    const autoDelete = localSource.autoDeleteAfterWatch;

    const snapshot = () =>
      etatLectureLocale(positionRef.current, durationRef.current ?? 0, seuilRef.current);

    // File TOUJOURS alimentée : plus de reporting live en lecture locale, la
    // file est l'unique chemin vers Jellyfin (drainée en fin de lecture en
    // ligne, au retour en ligne sinon — filet anti-crash inclus).
    const persist = () => {
      const { ticks, played } = snapshot();
      if (ticks <= 0 && !played) return;
      void saveLocalPlaybackState(userId, itemId, ticks, played, true);
    };

    const interval = setInterval(persist, SAVE_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      const { ticks, played } = snapshot();
      const save = (ticks > 0 || played)
        ? saveLocalPlaybackState(userId, itemId, ticks, played, true)
        : Promise.resolve();
      // Drain immédiat en ligne : Jellyfin reçoit la position finale dès la
      // sortie du lecteur (reprise cross-device). La promesse est publiée dans
      // stopPromiseRef : l'invalidation de WatchDesktop attend ce drain pour
      // relire un état « vu » frais.
      const syncDone = save
        .then(async () => {
          if (onlineRef.current) await drainReportQueue(userId);
        })
        .catch(() => {
          /* hors ligne / échec : la file reste, drainée au retour en ligne */
        });
      if (stopPromiseRef) stopPromiseRef.current = syncDone;
      // Auto-suppression : l'échéance a été posée côté natif par le
      // playback_set final (scheduleOnPlayed) — la purge immédiate couvre
      // le délai 0 « immédiatement » (item exempté de la garde de lecture) ;
      // les délais plus longs partent au tick 60 s ou au prochain démarrage.
      if (autoDelete && played) {
        void save.then(() => purgeDueDownloads(itemId));
      }
    };
  }, [enabled, userId, itemId, localSource, positionRef, stopPromiseRef]);
}
