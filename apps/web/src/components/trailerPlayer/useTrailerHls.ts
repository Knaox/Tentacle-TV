/**
 * Pose le flux relayé d'une bande-annonce sur son `<video>` : hls.js pour un
 * maître HLS (Chromium, donc Electron sur les trois systèmes), l'élément seul
 * pour un MP4 ou là où hls.js manque (Safari ancien).
 *
 * La qualité garde le maître « Auto » : chaque hauteur offerte par le serveur
 * (`qualities`) correspond à un niveau de hls.js — le relais ne garde que du
 * H.264, mêmes hauteurs —, et le choix se fait par `currentLevel` sans
 * recharger la vidéo. `null` : Auto (l'ABR de hls.js). En lecture native, une
 * hauteur passe par le maître réduit du relais, à la même position.
 *
 * hls.js est celui de l'aperçu (`loadPreviewHls`), chargé une fois, à la demande.
 */

import { useEffect, useRef, type MutableRefObject } from "react";
import type Hls from "hls.js";
import { trailerQualityUrl, type TrailerStream } from "@tentacle-tv/shared";
import { loadPreviewHls } from "../../trailerPreview/previewSource";
import { watchHlsErrors } from "../../hooks/hlsErrorRecovery";

/** Le tampon d'une vraie lecture : trente secondes d'avance, une bande-annonce entière en deux fois. */
const BUFFER_S = 30;
const MAX_BUFFER_S = 60;

/** L'index hls.js de la hauteur voulue (le plus riche à hauteur égale) ; -1 : Auto. */
export function levelForHeight(levels: ReadonlyArray<{ height?: number; bitrate?: number }>, height: number | null): number {
  if (height === null) return -1;
  let best = -1;
  levels.forEach((level, index) => {
    if (level.height !== height) return;
    if (best < 0 || (level.bitrate ?? 0) > (levels[best]?.bitrate ?? 0)) best = index;
  });
  return best;
}

interface Options {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  stream: TrailerStream | null;
  /** Le chemin relatif → l'adresse absolue (base du serveur). */
  serverUrl: string;
  /** La hauteur choisie ; `null` : Auto. */
  quality: number | null;
  onFatal: (reason: string) => void;
}

export function useTrailerHls({ videoRef, stream, serverUrl, quality, onFatal }: Options): void {
  const hlsRef = useRef<Hls | null>(null);
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const fatalRef = useRef(onFatal);
  fatalRef.current = onFatal;

  // Un flux neuf : tout se repose, à la qualité choisie à cet instant.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    let cancelled = false;
    const nativeSrc = () => trailerQualityUrl(stream, serverUrl, qualityRef.current);
    const playNatively = (src: string) => {
      video.src = src;
      video.load();
    };

    if (stream.type !== "m3u8") {
      playNatively(stream.url);
    } else {
      void loadPreviewHls().then((HlsCtor) => {
        if (cancelled) return;
        if (!HlsCtor.isSupported()) {
          playNatively(nativeSrc());
          return;
        }
        const hls = new HlsCtor({
          capLevelToPlayerSize: false,
          maxBufferLength: BUFFER_S,
          maxMaxBufferLength: MAX_BUFFER_S,
          enableWorker: true,
          // Les sous-titres viennent à part, en WebVTT relayé : aucun dans le flux.
          renderTextTracksNatively: false,
          enableWebVTT: false,
          enableCEA708Captions: false,
        });
        hlsRef.current = hls;
        hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
          const level = levelForHeight(hls.levels, qualityRef.current);
          // La plus haute au départ (règle de la TV) : elle se fixe avant le premier fragment.
          if (level >= 0) {
            hls.startLevel = level;
            hls.currentLevel = level;
          }
        });
        watchHlsErrors(hls, {
          onManifestRefused: () => false,
          onFail: (failure) => fatalRef.current(failure.from === "engine" ? `hls : ${failure.failure.code ?? failure.failure.kind ?? "échec"}` : "hls"),
        });
        hls.loadSource(stream.url);
        hls.attachMedia(video);
      }, () => {
        if (!cancelled) playNatively(nativeSrc());
      });
    }

    const onError = () => {
      // Une erreur de l'élément lui-même (MP4, lecture native) ; hls.js dit les siennes.
      if (!hlsRef.current) fatalRef.current(`élément : ${video.error?.code ?? "?"}`);
    };
    video.addEventListener("error", onError);
    return () => {
      cancelled = true;
      video.removeEventListener("error", onError);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [videoRef, stream, serverUrl]);

  // Un autre choix de qualité, flux inchangé.
  useEffect(() => {
    const video = videoRef.current;
    const hls = hlsRef.current;
    if (!video || !stream) return;
    if (hls) {
      if (hls.levels.length === 0) return;
      const level = levelForHeight(hls.levels, quality);
      // En Auto, `currentLevel` rend le niveau joué, pas -1 : c'est `autoLevelEnabled` qui le dit.
      if (level < 0 ? !hls.autoLevelEnabled : hls.autoLevelEnabled || hls.currentLevel !== level) hls.currentLevel = level;
      return;
    }
    if (stream.type !== "m3u8") return;
    // Lecture native : le maître réduit, repris à la même position.
    const target = trailerQualityUrl(stream, serverUrl, quality);
    if (video.currentSrc === target || !video.currentSrc) return;
    const at = video.currentTime;
    const wasPaused = video.paused;
    video.src = target;
    video.addEventListener("loadedmetadata", () => {
      video.currentTime = at;
      if (!wasPaused) void video.play().catch(() => undefined);
    }, { once: true });
  }, [videoRef, stream, serverUrl, quality]);
}
