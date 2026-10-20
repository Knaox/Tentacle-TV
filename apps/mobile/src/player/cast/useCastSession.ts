import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaybackReporting, useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, type MediaItem } from "@tentacle-tv/shared";
import {
  TentacleCast, type CastAvailability, type CastStatusEvent,
} from "../../../modules/tentacle-cast";
import { castItemPosition, castPhase, castReceiverTarget, type CastPhase } from "./castPlan";
import { negotiateCast, type CastNegotiation } from "./castNegotiate";

/** Ce que la diffusion emprunte au lecteur local (`PlayerPlayback`). */
interface LocalPlayer {
  positionRef: { current: number };
  mediaSourceId: string | undefined;
  audioIndex: number;
  subtitleIndex: number;
  reporting: { reportStop: () => Promise<void> };
  fetchPlaybackInfo: (opts?: { startTimeTicks?: number }) => void;
}

interface Args {
  itemId: string;
  item: MediaItem | undefined;
  pb: LocalPlayer;
  setPaused: (paused: boolean) => void;
  /** Le titre est allé au bout sur la TV : quitter le lecteur. */
  onFinished: () => void;
}

export interface CastSession {
  /** Une TV est à portée (ou reliée) : le bouton se montre. */
  available: boolean;
  /** La TV a la main : l'écran de diffusion remplace les commandes. */
  active: boolean;
  phase: CastPhase;
  deviceName: string | null;
  failure: "noSource" | "unreachable" | "failed" | null;
  /** Secondes du TITRE. */
  position: number;
  duration: number;
  openPicker: () => void;
  togglePlay: () => void;
  seekTo: (itemSeconds: number) => void;
  seekBy: (delta: number) => void;
  stop: () => void;
}

/**
 * La diffusion du lecteur mobile Android vers une TV (Google Cast). Le
 * téléphone ne lit plus rien : la lecture locale se met en pause et rend son
 * encodage, la TV reçoit un flux négocié POUR ELLE à la même position, et le
 * téléphone rapporte la progression à Jellyfin à sa place. Arrêter la
 * diffusion rend la main au téléphone, en pause, là où la TV en était ;
 * quitter le lecteur arrête la diffusion (comme AirPlay, qui ne survit pas au
 * lecteur). La notification de Google Cast pilote la TV hors de l'app.
 */
export function useCastSession({ itemId, item, pb, setPaused, onFinished }: Args): CastSession {
  const client = useJellyfinClient();
  const userId = useUserId();
  const [availability, setAvailability] = useState<CastAvailability>("unavailable");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [status, setStatus] = useState<CastStatusEvent | null>(null);
  const [negotiation, setNegotiation] = useState<CastNegotiation | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<CastSession["failure"]>(null);
  const live = useRef({ negotiation, pb, onFinished, started: false, ended: false });
  live.current = { ...live.current, negotiation, pb, onFinished };

  const reporting = usePlaybackReporting({
    itemId, mediaSourceId: negotiation?.mediaSourceId, isDirectPlay: negotiation?.directPlay ?? false,
    playSessionId: negotiation?.playSessionId, audioStreamIndex: pb.audioIndex,
    subtitleStreamIndex: pb.subtitleIndex >= 0 ? pb.subtitleIndex : null,
  });
  const reportingRef = useRef(reporting);
  reportingRef.current = reporting;

  // Google Cast démarre avec le lecteur ; sans Google Play services, rien.
  useEffect(() => {
    let cancelled = false;
    const subs = [
      TentacleCast.addListener("onCastState", (e) => { setAvailability(e.state); setDeviceName(e.deviceName); }),
      TentacleCast.addListener("onCastStatus", setStatus),
    ];
    void TentacleCast.start().then(async (ok) => {
      const state = ok ? await TentacleCast.getState() : null;
      if (!cancelled && state) { setAvailability(state.state); setDeviceName(state.deviceName); }
    });
    return () => { cancelled = true; subs.forEach((s) => s?.remove()); };
  }, []);

  /** Charge le titre sur la TV, à `itemSeconds`. */
  const load = useCallback(async (itemSeconds: number) => {
    if (!userId) return;
    setLoading(true);
    setFailure(null);
    const { pb: local } = live.current;
    try {
      const next = await negotiateCast({
        client, userId, itemId, item, mediaSourceId: local.mediaSourceId,
        audioIndex: local.audioIndex, subtitleIndex: local.subtitleIndex, startSeconds: itemSeconds,
      });
      if (typeof next === "string") { setFailure(next); return; }
      live.current.started = false;
      live.current.ended = false;
      setNegotiation(next);
      if (!(await TentacleCast.load(next.request))) setFailure("failed");
    } catch {
      setFailure("noSource");
    } finally {
      setLoading(false);
    }
  }, [client, userId, itemId, item]);

  // Une TV vient d'être reliée : le téléphone se tait, la TV prend la suite.
  const connected = availability === "connected";
  useEffect(() => {
    if (!connected || negotiation || loading || !item) return;
    setPaused(true);
    void live.current.pb.reporting.reportStop();
    void load(live.current.pb.positionRef.current);
  }, [connected, negotiation, loading, item, load, setPaused]);

  // La progression de la TV : position gardée pour le téléphone, rapportée à Jellyfin.
  useEffect(() => {
    const neg = live.current.negotiation;
    if (!status || !neg || (status.contentId && status.contentId !== neg.request.url)) return;
    const position = castItemPosition(status.position, neg.offset);
    live.current.pb.positionRef.current = position;
    const report = reportingRef.current;
    if (status.playerState === "playing" && !live.current.started) {
      live.current.started = true;
      report.reportStart(position);
    }
    if (live.current.started) report.updatePosition(position, status.playerState === "paused");
    if (status.playerState === "idle" && status.idleReason === "error") setFailure("failed");
    if (status.playerState === "idle" && status.idleReason === "finished" && !live.current.ended) {
      live.current.ended = true;
      void report.reportStop().finally(() => { TentacleCast.endSession(); live.current.onFinished(); });
    }
  }, [status]);

  // La diffusion s'arrête (bouton, notification, TV éteinte) : le téléphone
  // reprend la main, en pause, là où la TV en était.
  useEffect(() => {
    if (connected || availability === "connecting" || !negotiation) return;
    void reportingRef.current.reportStop();
    setNegotiation(null);
    setStatus(null);
    setFailure(null);
    // Le titre est allé au bout sur la TV : on quitte le lecteur, rien à relancer.
    if (live.current.ended) return;
    const ticks = Math.floor(live.current.pb.positionRef.current * TICKS_PER_SECOND);
    live.current.pb.fetchPlaybackInfo({ startTimeTicks: ticks > 0 ? ticks : undefined });
  }, [connected, availability, negotiation]);

  // Quitter le lecteur arrête la diffusion (rapport d'arrêt d'abord).
  useEffect(() => () => {
    if (!live.current.negotiation || live.current.ended) return;
    void reportingRef.current.reportStop();
    TentacleCast.endSession();
  }, []);

  const offset = negotiation?.offset ?? 0;
  const position = status && negotiation ? castItemPosition(status.position, offset) : pb.positionRef.current;
  const seekTo = useCallback((itemSeconds: number) => {
    const neg = live.current.negotiation;
    if (!neg) return;
    // Avant le début d'un flux transcodé : la TV ne l'a pas, on le redemande.
    if (!neg.directPlay && itemSeconds < neg.offset) void load(itemSeconds);
    else TentacleCast.seek(castReceiverTarget(itemSeconds, neg.offset));
  }, [load]);

  return {
    available: availability === "notConnected" || availability === "connecting" || connected,
    active: connected || availability === "connecting",
    phase: castPhase(connected ? "connected" : availability === "connecting" ? "connecting" : "other",
      status?.playerState ?? null, status?.idleReason ?? null, loading || negotiation !== null),
    deviceName,
    failure,
    position,
    duration: item?.RunTimeTicks ? item.RunTimeTicks / TICKS_PER_SECOND : 0,
    openPicker: TentacleCast.showPicker,
    togglePlay: () => (status?.playerState === "playing" ? TentacleCast.pause() : TentacleCast.play()),
    seekTo,
    seekBy: (delta) => seekTo(position + delta),
    stop: TentacleCast.endSession,
  };
}
