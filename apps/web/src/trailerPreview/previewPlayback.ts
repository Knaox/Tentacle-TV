import { TRAILER_PREVIEW_TIMING } from "@tentacle-tv/shared";

/**
 * La lecture d'un aperçu déjà chargé : la mise en route (avec le son, ou en
 * muet si le navigateur le refuse), la garde contre une lecture qui ne
 * progresse plus, et le glissement du volume. Sur un élément réduit à ce
 * qu'il faut — les tests passent un double.
 */
export type PlaybackVideo = Pick<HTMLVideoElement, "muted" | "volume" | "play" | "pause" | "addEventListener" | "removeEventListener">;

export interface PlaybackCallbacks {
  onSoundBlocked: () => void;
  onError: () => void;
}

const isNamed = (error: unknown, name: string) =>
  typeof error === "object" && error !== null && (error as { name?: unknown }).name === name;

/**
 * Lance la lecture. Le son part de zéro (le fondu le monte, cf. `rampVolume`).
 * Le navigateur refuse une lecture SONORE sans geste de l'utilisateur sur la
 * page (web) : la lecture repart en muet, sans erreur, et `onSoundBlocked` le
 * dit — le bouton du son le rendra d'un clic. Electron ne refuse jamais
 * (politique `no-user-gesture-required`, son défaut).
 *
 * Rend l'annulation : une réponse tardive de `play()` ne fait plus rien.
 */
export function startPreviewPlayback(video: PlaybackVideo, wantSound: boolean, callbacks: PlaybackCallbacks): () => void {
  let cancelled = false;
  video.volume = 0;
  video.muted = !wantSound;
  const attempt = (sound: boolean): void => {
    video.play().catch((error: unknown) => {
      if (cancelled || isNamed(error, "AbortError")) return;
      if (sound && isNamed(error, "NotAllowedError")) {
        video.muted = true;
        callbacks.onSoundBlocked();
        attempt(false);
        return;
      }
      callbacks.onError();
    });
  };
  attempt(wantSound);
  return () => {
    cancelled = true;
  };
}

/**
 * Une lecture montrée qui attend ses données (`waiting`) plus de
 * `stallTimeoutMs` sans reprendre est un échec : l'aperçu s'efface plutôt que
 * de rester figé. Rend le désabonnement.
 */
export function watchPreviewStall(
  video: PlaybackVideo,
  onStall: () => void,
  stallMs: number = TRAILER_PREVIEW_TIMING.stallTimeoutMs,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const onWaiting = () => {
    clear();
    timer = setTimeout(onStall, stallMs);
  };
  video.addEventListener("waiting", onWaiting);
  video.addEventListener("playing", clear);
  video.addEventListener("timeupdate", clear);
  return () => {
    clear();
    video.removeEventListener("waiting", onWaiting);
    video.removeEventListener("playing", clear);
    video.removeEventListener("timeupdate", clear);
  };
}

/** Le pas d'animation (requestAnimationFrame), injecté par les tests. */
export interface FrameScheduler {
  request: (callback: (now: number) => void) => number;
  cancel: (handle: number) => void;
  now: () => number;
}

const browserFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
  now: () => performance.now(),
};

/**
 * Fait glisser le volume jusqu'à `to` en `durationMs` — en courbe
 * quadratique : l'oreille entend le volume en logarithme, une rampe linéaire
 * paraîtrait arriver d'un coup. Rend l'arrêt.
 */
export function rampVolume(
  video: Pick<PlaybackVideo, "volume">,
  to: number,
  durationMs: number,
  frames: FrameScheduler = browserFrames,
): () => void {
  const from = video.volume;
  const target = Math.min(1, Math.max(0, to));
  if (from === target || durationMs <= 0) {
    video.volume = target;
    return () => undefined;
  }
  const start = frames.now();
  let handle: number | null = null;
  const step = (now: number) => {
    const progress = Math.min(1, Math.max(0, (now - start) / durationMs));
    const eased = target > from ? progress * progress : 1 - (1 - progress) * (1 - progress);
    video.volume = from + (target - from) * eased;
    handle = progress < 1 ? frames.request(step) : null;
  };
  handle = frames.request(step);
  return () => {
    if (handle !== null) frames.cancel(handle);
    handle = null;
  };
}
