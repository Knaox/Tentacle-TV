import { memo, useEffect, useRef } from "react";
import { TRAILER_PREVIEW_TIMING } from "@tentacle-tv/shared";
import { attachPreviewSource, type PreviewSourceSession } from "./previewSource";
import { rampVolume, startPreviewPlayback, watchPreviewStall } from "./previewPlayback";
import { openPreviewBench } from "./previewBench";
import { measureVideoCrop } from "./previewFrameCrop";
import type { TrailerPreviewVideoProps } from "./previewTypes";

/**
 * L'élément vidéo d'un aperçu de bande-annonce.
 *
 * Monté par la mini-carte dès que `handle.mount` est vrai : la source se pose
 * aussitôt, CACHÉE et EN PAUSE, jusqu'à sa première image (`onReady`). La
 * lecture part quand `playing` est vrai et `hold` faux, le son glisse vers
 * `volume`. Toute erreur fatale, ou une lecture figée, rend `onError` : la
 * mini-carte ne se montre pas, ou s'efface. Au démontage — et à chaque cycle —
 * hls.js est détruit et l'élément vidé : rien ne consomme une fois caché.
 *
 * ⚠️ Pendant le chargement, cacher la mini-carte par l'OPACITÉ, jamais par
 * `display: none` : une vidéo non rendue ne compose pas sa première image, qui
 * n'arriverait à l'écran qu'au moment de se montrer.
 */
export const TrailerPreviewVideo = memo(function TrailerPreviewVideo(props: TrailerPreviewVideoProps) {
  const { stream, muted, playing, volume, cycle, hold = false, className, style } = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<PreviewSourceSession | null>(null);
  // Les rappels du rendu le plus récent, sans relancer les effets à chaque identité neuve.
  const latest = useRef(props);
  latest.current = props;

  const src = stream?.src ?? null;
  const kind = stream?.kind ?? null;
  const mimeType = stream?.mimeType ?? null;
  useEffect(() => {
    const video = videoRef.current;
    const current = latest.current.stream;
    if (!video || !current || src === null) return;
    const bench = openPreviewBench(video);
    bench.record("attach", { kind: current.kind });
    const session = attachPreviewSource(video, current, {
      onReady: () => {
        // Le letterbox incrusté, mesuré UNE fois sur cette première image — jamais pour une
        // VOSTFR : ses sous-titres incrustés vivent dans la bande noire du bas.
        const started = performance.now();
        const crop = current.burnedSubtitles ? 1 : measureVideoCrop(video);
        bench.record("ready", { crop, cropMs: Math.round((performance.now() - started) * 100) / 100 });
        // Rognée, la vidéo s'affiche plus grande : le plafond de qualité suit (jamais un niveau agrandi).
        if (crop > 1) sessionRef.current?.setCrop(crop);
        latest.current.onReady({ crop });
      },
      onFragment: () => {
        bench.record("fragment");
        latest.current.onFragment();
      },
      onError: () => {
        bench.record("failed");
        latest.current.onError();
      },
      onHls: bench.onHls,
    });
    sessionRef.current = session;
    if (latest.current.playing) session.unleash();
    return () => {
      bench.close();
      session.release();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [src, kind, mimeType, cycle]);

  // Montrée : le tampon d'avance s'élargit (avant, seul le premier segment se charge).
  useEffect(() => {
    if (playing) sessionRef.current?.unleash();
  }, [playing, cycle]);

  // La lecture : retenue sur la première image tant que la mini-carte s'agrandit (`hold`).
  const running = playing && !hold && src !== null;
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !running) {
      video?.pause();
      return;
    }
    const callbacks = {
      onSoundBlocked: () => latest.current.onSoundBlocked(),
      onError: () => latest.current.onError(),
    };
    const cancelPlay = startPreviewPlayback(video, !latest.current.muted, callbacks);
    const unwatch = watchPreviewStall(video, () => latest.current.onError());
    return () => {
      cancelPlay();
      unwatch();
    };
  }, [running, cycle]);

  // Le son coupé ou rendu d'un geste, en cours de lecture.
  useEffect(() => {
    const video = videoRef.current;
    if (video && running) video.muted = muted;
  }, [muted, running]);

  // Le volume glisse : fondu d'entrée à la révélation, de sortie au départ.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !running) return;
    const rising = volume > video.volume;
    return rampVolume(video, volume, rising ? TRAILER_PREVIEW_TIMING.audioFadeInMs : TRAILER_PREVIEW_TIMING.exitMs);
  }, [volume, running]);

  return (
    <video
      ref={videoRef}
      className={className}
      style={style}
      playsInline
      preload="auto"
      disablePictureInPicture
      disableRemotePlayback
      aria-hidden="true"
      tabIndex={-1}
      onEnded={() => latest.current.onEnded()}
    />
  );
});
