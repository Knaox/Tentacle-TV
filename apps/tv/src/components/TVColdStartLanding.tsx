import { useEffect, useRef, useState } from "react";
import {
  flushPlaybackOutboxFor, JellyfinError, useAdoptStop, useJellyfinClient, useMediaItem, type StorageAdapter,
} from "@tentacle-tv/api-client";
import {
  clearPlaybackMarker, coldStartLanding, readPlaybackMarker, type ColdStartLanding, type PlaybackMarker,
} from "@tentacle-tv/tv-core/playback";
import { sessionOwnerOf } from "../auth/sessionOwner";
import { navigationRef } from "../navigation/navigationRef";
import { markerStopToAdopt } from "../utils/coldStartResume";
import { plog } from "../utils/playerDiag";

/** Le temps laissé à la file des rapports pour corriger la position avant de rouvrir. */
const OUTBOX_WAIT_MS = 4_000;
/** Au-delà, la fiche du titre ne vient pas : jamais de lecteur ouvert dans le vide. */
const ITEM_WAIT_MS = 8_000;
const NAV_RETRY_MS = 200;
const NAV_RETRIES = 25;

type Target = Exclude<ColdStartLanding, { kind: "home" }>;

/**
 * La relance à froid (règle : tv-core `playback/coldStart`). Au démarrage, une
 * fois : le marqueur du lecteur dit comment l'app est morte — tuée pendant son
 * absence → le LECTEUR rouvert EN PAUSE à la position ; morte à l'écran → la
 * FICHE, « Reprendre » focalisé ; sinon l'accueil. Le marqueur est retiré
 * aussitôt lu : une seconde relance ne rejoue rien.
 *
 * Avant de rouvrir : la file des rapports d'abord (la position relue doit être
 * la bonne), puis la fiche du titre. Refusée (jeton révoqué), on ne bouge pas —
 * le déjumelage prend la main ; muette (serveur ou Jellyfin coupé), on ouvre la
 * fiche plutôt qu'un lecteur vide. Un déjumelage interrompu, lui, s'est rejoué
 * avant (`resumeUnpair`, au démarrage) et a purgé le marqueur avec le compte.
 * Rouvert en pause, le lecteur part de l'arrêt du marqueur quand Jellyfin n'a
 * rien vu de plus récent (`markerStopToAdopt`) — la garde le défend ensuite.
 */
export function TVColdStartLanding({ storage }: { storage: StorageAdapter }) {
  const client = useJellyfinClient();
  const [target, setTarget] = useState<{ landing: Target; marker: PlaybackMarker } | null>(null);

  useEffect(() => {
    const marker = readPlaybackMarker(storage);
    clearPlaybackMarker(storage);
    const landing = coldStartLanding(marker, { now: Date.now(), owner: sessionOwnerOf(storage, client.getDeviceId()) });
    if (marker) plog("relance", `marqueur ${marker.phase}, ${Math.round((Date.now() - marker.at) / 1000)} s → ${landing.kind}`);
    if (landing.kind !== "home" && marker) setTarget({ landing, marker });
    // Une fois par démarrage à froid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return target
    ? <Landing storage={storage} target={target.landing} marker={target.marker} onDone={() => setTarget(null)} />
    : null;
}

function Landing({ storage, target, marker, onDone }: {
  storage: StorageAdapter; target: Target; marker: PlaybackMarker; onDone: () => void;
}) {
  const client = useJellyfinClient();
  const adoptStop = useAdoptStop();
  const [flushed, setFlushed] = useState(false);
  const { data: item, error } = useMediaItem(target.itemId, { enabled: flushed });
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const land = (kind: Target["kind"] | null) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const attempt = (n: number) => {
      if (!navigationRef.isReady()) {
        if (n < NAV_RETRIES) setTimeout(() => attempt(n + 1), NAV_RETRY_MS);
        else onDoneRef.current();
        return;
      }
      // L'utilisateur a déjà bougé, ou l'app est repartie au jumelage : on ne détourne rien.
      if (kind && navigationRef.getCurrentRoute()?.name === "Home") {
        plog("relance", `→ ${kind === "player" ? "lecteur en pause" : "fiche"}`);
        if (kind === "player") navigationRef.navigate("Player", { itemId: target.itemId, startPaused: true });
        else navigationRef.navigate("MediaDetail", { itemId: target.itemId });
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
    const giveUp = setTimeout(() => land("detail"), OUTBOX_WAIT_MS + ITEM_WAIT_MS);
    return () => clearTimeout(giveUp);
    // Une fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!flushed) return;
    if (item) {
      const position = target.kind === "player" ? markerStopToAdopt(marker, item) : null;
      if (position !== null) {
        plog("relance", `arrêt du marqueur (${Math.round(position)} s) préféré à la reprise relue`);
        adoptStop({ itemId: item.Id, positionSeconds: position, runtimeTicks: item.RunTimeTicks, stoppedAt: marker.at });
      }
      land(target.kind);
    } else if (error) {
      const refused = error instanceof JellyfinError && (error.status === 401 || error.status === 403);
      land(refused ? null : "detail");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flushed, item, error]);

  return null;
}
