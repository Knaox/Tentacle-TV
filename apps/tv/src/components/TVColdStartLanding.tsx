import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  flushPlaybackOutboxFor, JellyfinError, useAdoptStop, useJellyfinClient, useMediaItem, type StorageAdapter,
} from "@tentacle-tv/api-client";
import {
  clearPlaybackMarker, coldStartDetailId, coldStartLanding, readPlaybackMarker,
  type DetailLanding, type PlaybackMarker,
} from "@tentacle-tv/tv-core/playback";
import type { MediaItem } from "@tentacle-tv/shared";
import { sessionOwnerOf } from "../auth/sessionOwner";
import { navigationRef } from "../navigation/navigationRef";
import { markerStopToAdopt, settleSeriesResume } from "../utils/coldStartResume";
import { plog } from "../utils/playerDiag";

/** Le temps laissé à la file des rapports pour corriger la position avant d'ouvrir. */
const OUTBOX_WAIT_MS = 4_000;
/** Au-delà, l'item lu ne vient pas : la fiche s'ouvre d'après le marqueur seul. */
const ITEM_WAIT_MS = 8_000;
const NAV_RETRY_MS = 200;
const NAV_RETRIES = 25;

/**
 * La relance à froid (règle : tv-core `playback/coldStart`). Au démarrage, une
 * fois : le marqueur du lecteur dit qu'une lecture a été interrompue par la
 * mort de l'app → la FICHE de ce qui était lu, « Reprendre » focalisé — celle
 * du film ; celle de la SÉRIE pour un épisode, ouverte sur la saison de la
 * reprise. JAMAIS le lecteur : un titre qui pose problème ferait replanter
 * l'app à chaque ouverture. Sans marqueur : l'accueil. Le marqueur est retiré
 * aussitôt lu : une seconde relance ne rejoue rien. La fiche est poussée sur
 * l'accueil : Retour y ramène.
 *
 * Avant d'ouvrir : la file des rapports d'abord (la position relue doit être
 * la bonne), puis l'item lu. Refusé (jeton révoqué), on ne bouge pas — le
 * déjumelage prend la main ; muet (serveur ou Jellyfin coupé), la fiche quand
 * même, d'après le marqueur. Un déjumelage interrompu, lui, s'est rejoué avant
 * (`resumeUnpair`, au démarrage) et a purgé le marqueur avec le compte.
 * « Reprendre » : la position que la file a rejouée ; l'app tuée pendant son
 * absence, l'arrêt du marqueur, exact, quand Jellyfin n'a rien vu de plus
 * récent (`markerStopToAdopt`) — la garde le défend ensuite ; pour un épisode,
 * jusque dans l'état de visionnage de la série (`settleSeriesResume`), avant
 * d'ouvrir sa fiche.
 */
export function TVColdStartLanding({ storage }: { storage: StorageAdapter }) {
  const client = useJellyfinClient();
  const [target, setTarget] = useState<{ landing: DetailLanding; marker: PlaybackMarker } | null>(null);

  useEffect(() => {
    const marker = readPlaybackMarker(storage);
    clearPlaybackMarker(storage);
    const landing = coldStartLanding(marker, { now: Date.now(), owner: sessionOwnerOf(storage, client.getDeviceId()) });
    if (marker) plog("relance", `marqueur ${marker.phase}, ${Math.round((Date.now() - marker.at) / 1000)} s → ${landing.kind}`);
    if (landing.kind === "detail" && marker) setTarget({ landing, marker });
    // Une fois par démarrage à froid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return target
    ? <Landing storage={storage} landing={target.landing} marker={target.marker} onDone={() => setTarget(null)} />
    : null;
}

function Landing({ storage, landing, marker, onDone }: {
  storage: StorageAdapter; landing: DetailLanding; marker: PlaybackMarker; onDone: () => void;
}) {
  const client = useJellyfinClient();
  const queryClient = useQueryClient();
  const adoptStop = useAdoptStop();
  const [flushed, setFlushed] = useState(false);
  const { data: item, error } = useMediaItem(landing.itemId, { enabled: flushed });
  const doneRef = useRef(false);
  // L'item relu ne se traite qu'une fois : l'adoption le patche, et la fiche de
  // la série attend que sa reprise soit posée.
  const handledRef = useRef(false);
  // La meilleure fiche connue — celle du marqueur, puis celle de l'item relu.
  const detailRef = useRef(coldStartDetailId(landing));
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  /** `null` : rien à ouvrir (le déjumelage prend la main). */
  const land = (detailId: string | null) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const attempt = (n: number) => {
      if (!navigationRef.isReady()) {
        if (n < NAV_RETRIES) setTimeout(() => attempt(n + 1), NAV_RETRY_MS);
        else onDoneRef.current();
        return;
      }
      // L'utilisateur a déjà bougé, ou l'app est repartie au jumelage : on ne détourne rien.
      if (detailId && navigationRef.getCurrentRoute()?.name === "Home") {
        plog("relance", `→ fiche ${detailId === landing.itemId ? "du titre" : "de la série"}`);
        navigationRef.navigate("MediaDetail", { itemId: detailId });
      }
      onDoneRef.current();
    };
    attempt(0);
  };

  useEffect(() => {
    const owner = sessionOwnerOf(storage, client.getDeviceId());
    const wait = new Promise((resolve) => setTimeout(resolve, OUTBOX_WAIT_MS));
    const flush = owner ? flushPlaybackOutboxFor(client, owner.userId) : Promise.resolve();
    void Promise.race([flush, wait]).catch(() => undefined).finally(() => setFlushed(true));
    const giveUp = setTimeout(() => land(detailRef.current), OUTBOX_WAIT_MS + ITEM_WAIT_MS);
    return () => clearTimeout(giveUp);
    // Une fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!flushed || handledRef.current || (!item && !error)) return;
    handledRef.current = true;
    if (item) {
      detailRef.current = coldStartDetailId(landing, item);
      const position = markerStopToAdopt(marker, item);
      const stop = position === null
        ? null
        : adoptStop({ itemId: item.Id, positionSeconds: position, runtimeTicks: item.RunTimeTicks, stoppedAt: marker.at });
      if (position !== null) plog("relance", `arrêt du marqueur (${Math.round(position)} s) préféré à la reprise relue`);
      const owner = sessionOwnerOf(storage, client.getDeviceId());
      if (stop && stop.positionTicks > 0 && item.Type === "Episode" && item.SeriesId && owner) {
        // L'épisode tel que l'adoption l'a patché : c'est lui que la fiche de la série reprendra.
        const episode = queryClient.getQueryData<MediaItem>(["item", item.Id]) ?? item;
        void settleSeriesResume(queryClient, client, owner.userId, item.SeriesId, {
          episode, positionTicks: stop.positionTicks, stoppedAt: marker.at,
        }).finally(() => land(detailRef.current));
      } else {
        land(detailRef.current);
      }
    } else {
      const refused = error instanceof JellyfinError && (error.status === 401 || error.status === 403);
      land(refused ? null : detailRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flushed, item, error]);

  return null;
}
