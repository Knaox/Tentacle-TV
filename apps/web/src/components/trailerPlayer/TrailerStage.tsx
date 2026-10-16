/**
 * La lecture RELAYÉE d'une bande-annonce : le flux demandé au serveur, posé
 * sur le `<video>` (hls.js), le chien de garde, les sous-titres, le son, le
 * clavier et les commandes. Un échec — refus du serveur, flux illisible,
 * rien à l'écran en 15 s — remonte au lecteur, qui décide de la suite (la
 * suivante, le lecteur officiel) ; la fin aussi.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { reportTrailerPlayback } from "@tentacle-tv/api-client";
import { heardTrailerItem, trailerInitialQuality, trailerItemKey, type TrailerQueueItem } from "@tentacle-tv/shared";
import { PlaybackSpinner } from "../player/PlaybackSpinner";
import { SkipBadge } from "../SkipBadge";
import { useControlsAutoHide } from "../../hooks/useControlsAutoHide";
import { usePlayerVolume } from "../../hooks/usePlayerVolume";
import { useSkipFlash } from "../../hooks/useSkipFlash";
import { useVideoStallWatch } from "../../hooks/useVideoStallWatch";
import { backendAbsoluteUrl } from "../../trailerPreview/previewStream";
import { TrailerPlayerControls } from "./TrailerPlayerControls";
import { trailerItemLabels } from "./trailerLabels";
import { steppedVolume, type TrailerKeyAction } from "./trailerPlayerKeys";
import { useTrailerHls } from "./useTrailerHls";
import { useTrailerKeys } from "./useTrailerKeys";
import { useTrailerResolve } from "./useTrailerResolve";
import { useTrailerSubtitles } from "./useTrailerSubtitles";
import { useTrailerVideoState } from "./useTrailerVideoState";
import { useTrailerWatch } from "./useTrailerWatch";

export interface TrailerStageProps {
  item: TrailerQueueItem;
  queue: readonly TrailerQueueItem[];
  index: number;
  language: string | null;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onFailure: (cause: "embed" | "failed") => void;
  onEnded: () => void;
  onNeighbor: (direction: 1 | -1) => void;
  onPick: (index: number) => void;
  onEscape: () => void;
  onClose: () => void;
}

export function TrailerStage(props: TrailerStageProps) {
  const { item, queue, index, language, fullscreen, onFailure } = props;
  const { t } = useTranslation("common");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const key = trailerItemKey(item.playback);
  const resolved = useTrailerResolve(item.playback);
  const stream = resolved?.status === "ready" ? resolved.stream : null;
  const streamKey = stream ? `${key}|${stream.url}` : null;
  const serverUrl = useMemo(() => backendAbsoluteUrl(""), []);

  // Un refus du serveur : la suite se décide plus haut (lecteur officiel, suivante).
  useEffect(() => {
    if (!resolved || resolved.status === "ready") return;
    onFailure(resolved.status === "embed" ? "embed" : "failed");
  }, [resolved, onFailure]);

  const [quality, setQuality] = useState<number | null>(null);
  useEffect(() => {
    setQuality(stream ? trailerInitialQuality(stream.qualities.map((q) => q.height)) : null);
  }, [stream]);

  // Ce qu'on ENTEND : un doublage par IA retiré par le serveur ne se dit pas VF (et appelle les sous-titres).
  const heard = useMemo(() => heardTrailerItem(item, stream, language), [item, stream, language]);
  const subtitles = useTrailerSubtitles(stream, { language, version: heard.version });
  const failed = useRef(false);
  const fail = useCallback((reason: string, ms = 0) => {
    if (failed.current) return;
    failed.current = true;
    reportTrailerPlayback(item.playback, { ok: false, ms, reason });
    onFailure("failed");
  }, [item.playback, onFailure]);
  useEffect(() => { failed.current = false; }, [streamKey]);

  useTrailerHls({ videoRef, stream, serverUrl, quality, onFatal: fail });
  const watch = useTrailerWatch(videoRef, streamKey, {
    onStarted: (ms) => reportTrailerPlayback(item.playback, { ok: true, ms }),
    onFailed: (reason) => fail(reason, 15_000),
    onEnded: props.onEnded,
  });
  useVideoStallWatch(videoRef, !!streamKey);

  const video = useTrailerVideoState(videoRef, streamKey);
  const { volume, handleVolumeChange, handleToggleMute } = usePlayerVolume({ videoRef, elementKey: streamKey ?? undefined });
  const { skipFlash, skipBy } = useSkipFlash(video.seekRelative);
  // Un panneau ouvert garde les commandes : elles ne s'effacent qu'en lecture, panneaux fermés.
  const [panelOpen, setPanelOpen] = useState(false);
  const { showControls, scheduleHide } = useControlsAutoHide(video.playing && !panelOpen);

  const pip = typeof document !== "undefined" && document.pictureInPictureEnabled
    ? () => {
      if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => undefined);
      else void videoRef.current?.requestPictureInPicture().catch(() => undefined);
    }
    : null;

  useTrailerKeys((action: TrailerKeyAction) => {
    scheduleHide();
    switch (action.kind) {
      case "togglePlay": return video.togglePlay();
      case "skip": return skipBy(action.delta);
      case "volume": return handleVolumeChange(steppedVolume(volume, action.delta));
      case "toggleMute": return handleToggleMute();
      case "toggleFullscreen": return props.onToggleFullscreen();
      case "toggleSubtitles": return subtitles.toggle();
      case "neighbor": return props.onNeighbor(action.direction);
      case "escape": return props.onEscape();
    }
  });

  const labels = trailerItemLabels(heard, subtitles.language, t);
  const loading = !watch.started || watch.waiting;

  return (
    <div
      className={`absolute inset-0 bg-black ${showControls ? "" : "cursor-none"}`}
      onMouseMove={scheduleHide}
      onClick={video.togglePlay}
      onDoubleClick={props.onToggleFullscreen}
    >
      <video ref={videoRef} key={key} className="absolute inset-0 h-full w-full object-contain" playsInline>
        {subtitles.vttUrl && <track key={subtitles.vttUrl} kind="subtitles" src={subtitles.vttUrl} srcLang={subtitles.selected ?? undefined} default />}
      </video>
      {loading && <PlaybackSpinner />}
      <SkipBadge flash={skipFlash} />
      <div className={`absolute inset-0 transition-opacity duration-300 ${showControls ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <TrailerPlayerControls
          item={item} labels={labels} queue={queue} index={index} language={subtitles.language} stream={stream}
          playing={video.playing} currentTime={video.currentTime} duration={video.duration} buffered={video.buffered}
          volume={volume} fullscreen={fullscreen} subtitle={subtitles.selected} quality={quality}
          onTogglePlay={video.togglePlay} onSeek={video.seek} onSkip={skipBy}
          onVolumeChange={handleVolumeChange} onToggleMute={handleToggleMute} onToggleFullscreen={props.onToggleFullscreen}
          onPip={pip} onNeighbor={props.onNeighbor} onPick={props.onPick}
          onSubtitle={subtitles.choose} onQuality={setQuality} onPanelOpenChange={setPanelOpen} onClose={props.onClose}
        />
      </div>
    </div>
  );
}
