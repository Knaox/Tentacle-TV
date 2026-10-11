import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Video, { type OnLoadData, type OnProgressData, type VideoRef } from "react-native-video";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { trailerQualityUrl, trailerSubtitleUrl } from "@tentacle-tv/tv-core";
import { plog } from "../../utils/playerDiag";
import { reportTrailerOutcome, resolveTrailerStream, type TrailerOutcome, type TrailerStream } from "./resolveTrailerStream";
import { useTrailerPlaybackWatch } from "./useTrailerPlaybackWatch";
import { useTrailerSubtitles, type TrailerClock } from "./useTrailerSubtitles";
import type { TrailerPlayerHandle, TrailerPlayerProps } from "./types";

/**
 * Le lecteur de bande-annonce, Apple TV ET Android TV : le serveur résout
 * l'ID YouTube et relaie le flux (`GET /api/trailers/resolve`, yt-dlp), lu ici
 * avec `react-native-video` (AVPlayer sur tvOS, ExoPlayer media3 sur Android,
 * qui lit le même maître HLS). Android passait par l'embed YouTube d'une
 * WebView : il lit désormais le flux de l'Apple TV, avec le même chien de
 * garde (le nom du fichier reste, ses consommateurs aussi).
 *
 * Chaque issue se dit : `onLoadEnd` à la première image à l'écran, `onEnded`
 * à la fin, `onError` sur tout le reste — résolution refusée ou trop longue
 * (`resolveTrailerStream`), flux refusé, rien qui démarre ou qui avance
 * (`useTrailerPlaybackWatch`). L'écran ne reste jamais au chargement. Chaque
 * issue part aussi au serveur (`reportTrailerOutcome`), avec son délai depuis
 * l'ouverture : c'est sa façon de voir, en production, que YouTube a changé.
 *
 * Le lecteur simplifié (props facultatives, cf. `types.ts`) : pause, saut
 * (`ref.seekTo`), qualité — une autre hauteur recharge le flux À LA MÊME
 * POSITION (`startPosition` natif), la première image déjà acquise : pas de
 * second chargement —, sous-titres en calque (`useTrailerSubtitles`). Un
 * serveur sans `trailers.player` n'offre ni qualité ni piste : listes vides.
 *
 * Le `<Video>` n'est pas focusable : la télécommande (Menu / Fermer) reste gérée
 * par l'écran — bouton « Fermer », pile native, gestes qui rallument le
 * chrome. Sur Android, la surface est une `SurfaceView` (le défaut de
 * react-native-video) : composée par le matériel, comme celle du lecteur.
 */
export const TRAILER_WEBVIEW_SUPPORTED = true;

/** Le tic du lecteur : la frise et les sous-titres suivent à ce pas. */
const PROGRESS_INTERVAL_MS = 250;
/**
 * Un saut ou un rechargement en cours : les tics qui disent encore l'ancienne
 * position (ou 0, avant la reprise) sont ignorés — la frise et les répliques
 * ne reculent pas — tant que le temps n'est pas à moins de `JUMP_TOLERANCE_S`
 * de la cible, et `JUMP_WINDOW_MS` au plus.
 */
const JUMP_TOLERANCE_S = 1.5;
const JUMP_WINDOW_MS = 5_000;

/** La source jouée : son adresse, et la position de reprise d'un changement de qualité. */
interface PlayedSource {
  uri: string;
  startMs?: number;
}

function TrailerPlayer(props: TrailerPlayerProps, ref: React.Ref<TrailerPlayerHandle>) {
  const { ytId, onLoadEnd, onError, onEnded, onWaitingChange, quality = null, subtitle = null, paused = false } = props;
  const { storage } = useTentacleConfig();
  const { i18n } = useTranslation();
  const [stream, setStream] = useState<TrailerStream | null>(null);
  const [played, setPlayed] = useState<PlayedSource | null>(null);
  const openedAt = useRef(Date.now());
  const server = useRef({ url: "", token: "" });
  const videoRef = useRef<VideoRef>(null);
  const clock = useRef<TrailerClock>({ position: 0, tickAt: 0, paused });
  const duration = useRef(0);
  const jump = useRef<{ target: number; until: number } | null>(null);
  // Lus au moment voulu, jamais une raison de relancer la résolution : les
  // rappels du lecteur simplifié, et la langue (qui ne fait que trier les pistes).
  const latest = useRef(props);
  latest.current = props;
  const lang = useRef("en");
  lang.current = (i18n.language ?? "en").slice(0, 2);

  // La première image une fois, l'échec une fois — même après la première
  // image : une lecture qui casse en route se dit aussi au serveur.
  const reported = useRef({ started: false, failed: false });
  const report = useCallback((outcome: Omit<TrailerOutcome, "ms">) => {
    const done = reported.current;
    if (outcome.ok ? done.started || done.failed : done.failed) return;
    if (outcome.ok) done.started = true;
    else done.failed = true;
    const ms = Date.now() - openedAt.current;
    plog("trailer", `${ytId} : ${outcome.ok ? `première image en ${ms} ms` : `échec après ${ms} ms (${outcome.reason})`}`);
    if (server.current.url) reportTrailerOutcome(server.current.url, server.current.token, ytId, { ...outcome, ms });
  }, [ytId]);

  useEffect(() => {
    let cancelled = false;
    const serverUrl = (storage.getItem("tentacle_server_url") ?? "").replace(/\/$/, "");
    const token = storage.getItem("tentacle_token") ?? "";
    server.current = { url: serverUrl, token };
    openedAt.current = Date.now();
    reported.current = { started: false, failed: false };
    clock.current = { position: 0, tickAt: 0, paused: clock.current.paused };
    duration.current = 0;
    jump.current = null;
    setStream(null);
    setPlayed(null);
    if (!serverUrl || !ytId) {
      onError();
      return;
    }
    void resolveTrailerStream(serverUrl, token, ytId, lang.current).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        const resolved = result.stream;
        plog("trailer", `flux ${resolved.type ?? "progressif"} résolu pour ${ytId} en ${Date.now() - openedAt.current} ms (${resolved.qualities.length} qualités, ${resolved.subtitles.length} pistes)`);
        // Les pistes AVANT le flux : l'écran y pose sa qualité de lancement
        // (la plus haute) et ses sous-titres, et la première source en tient
        // déjà compte. Dans l'ordre inverse, l'ancienne architecture de React
        // Native (aucun regroupement hors évènement) rendait le flux avant la
        // qualité : Auto chargé, puis la qualité de lancement — un second
        // chargement (mesuré au banc).
        latest.current.onTracks?.({ qualities: resolved.qualities, subtitles: resolved.subtitles });
        setStream(resolved);
      } else {
        report({ ok: false, reason: `résolution : ${result.reason}` });
        onError();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ytId, storage, onError, report]);

  const watch = useTrailerPlaybackWatch(stream?.url ?? null, {
    onStarted: () => {
      report({ ok: true });
      onLoadEnd();
    },
    onFailed: (reason) => {
      report({ ok: false, reason });
      onError();
    },
    onEnded: () => onEnded?.(),
    onWaitingChange,
  });

  // La qualité : la première source, puis un rechargement à la position courante.
  useEffect(() => {
    if (!stream) return;
    const uri = trailerQualityUrl(stream, server.current.url, quality);
    setPlayed((current) => {
      if (current?.uri === uri) return current;
      return current ? { uri, startMs: Math.round(clock.current.position * 1000) } : { uri };
    });
  }, [stream, quality]);

  /** Le temps va sauter à `target` : l'horloge, le chien de garde et le filtre des tics le savent. */
  const expectJump = useCallback((target: number) => {
    clock.current.position = target;
    clock.current.tickAt = Date.now();
    jump.current = { target, until: Date.now() + JUMP_WINDOW_MS };
    watch.expectJump(target);
  }, [watch]);

  // Un rechargement fait sauter le temps : on l'apprend quand la source change.
  const playedUri = played?.uri;
  const firstUri = useRef<string | null>(null);
  useEffect(() => {
    if (!playedUri) {
      firstUri.current = null;
      return;
    }
    if (firstUri.current === null) firstUri.current = playedUri;
    else expectJump(clock.current.position);
  }, [playedUri, expectJump]);

  useEffect(() => {
    clock.current.paused = paused;
    clock.current.tickAt = Date.now();
    watch.setPaused(paused);
  }, [paused, watch]);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      const max = duration.current > 0 ? duration.current : Number.POSITIVE_INFINITY;
      const target = Math.min(Math.max(0, seconds), max);
      expectJump(target);
      videoRef.current?.seek(target);
    },
  }), [expectJump]);

  const subtitleUrl = stream ? trailerSubtitleUrl(stream, server.current.url, subtitle) : null;
  useTrailerSubtitles(subtitleUrl, clock, props.onCue);

  const { handlers } = watch;
  const onProgress = useCallback((data: OnProgressData) => {
    // Un tic périmé n'atteint personne : le chien de garde y verrait le temps
    // reculer après un saut en arrière, et crierait à l'arrêt.
    const pending = jump.current;
    if (pending) {
      const landed = Math.abs(data.currentTime - pending.target) <= JUMP_TOLERANCE_S;
      if (!landed && Date.now() < pending.until) return;
      jump.current = null;
    }
    handlers.onProgress(data);
    clock.current.position = data.currentTime;
    clock.current.tickAt = Date.now();
    if (data.seekableDuration > 0) duration.current = data.seekableDuration;
    latest.current.onProgress?.({ position: data.currentTime, duration: duration.current, buffered: data.playableDuration });
  }, [handlers]);
  const onLoad = useCallback((data: OnLoadData) => {
    handlers.onLoad(data);
    if (data.duration > 0) duration.current = data.duration;
  }, [handlers]);

  // Mémorisée : un objet neuf à chaque rendu rechargerait la source native.
  const type = stream?.type;
  const source = useMemo(
    () => (played ? { uri: played.uri, type, startPosition: played.startMs } : undefined),
    [played, type],
  );

  // Tant que le flux n'est pas résolu, l'écran affiche son chargement.
  if (!source) return null;

  return (
    <Video
      ref={videoRef}
      source={source}
      style={{ flex: 1, backgroundColor: "#000" }}
      paused={paused}
      controls={false}
      resizeMode="contain"
      focusable={false}
      progressUpdateInterval={PROGRESS_INTERVAL_MS}
      {...handlers}
      onProgress={onProgress}
      onLoad={onLoad}
    />
  );
}

export const TrailerWebView = memo(forwardRef(TrailerPlayer));
