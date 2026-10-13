import type Hls from "hls.js";
import type { HlsConfig } from "hls.js";
import type { TrailerPreviewStream } from "./previewTypes";

/**
 * La source d'un aperçu posée sur son `<video>` : hls.js pour un maître HLS
 * (Chromium, donc Electron sur les trois systèmes), l'élément lui-même pour un
 * MP4 ou un HLS que le navigateur lit seul (Safari). Chargée CACHÉE et EN
 * PAUSE jusqu'à sa première image décodée ; tout se relâche à la sortie.
 *
 * hls.js est chargé à la demande (`import()`) : les cartes de l'accueil ne
 * tirent pas le lecteur dans le premier paquet de l'app.
 */

type HlsClass = typeof Hls;

let hlsLoading: Promise<HlsClass> | null = null;

/** Le module hls.js, chargé une fois (l'intention le précharge, cf. `preloadTrailerPreviewPlayer`). */
export function loadPreviewHls(): Promise<HlsClass> {
  hlsLoading ??= import("hls.js").then((module) => module.default);
  return hlsLoading;
}

/**
 * L'estimation de débit de départ (bit/s), avant toute mesure : celle d'une
 * connexion domestique ordinaire. Sans elle, hls.js part de 500 kbit/s et
 * pourrait juger la 1080p trop lourde avant d'avoir mesuré quoi que ce soit.
 */
export const PREVIEW_START_BANDWIDTH_ESTIMATE = 8_000_000;

/** Des délais courts : un aperçu qui traîne n'est pas montré (la machine abandonne à `readyTimeoutMs`). */
const PREVIEW_LOAD_POLICY = {
  default: {
    maxTimeToFirstByteMs: 6_000,
    maxLoadTimeMs: 15_000,
    timeoutRetry: { maxNumRetry: 1, retryDelayMs: 0, maxRetryDelayMs: 0 },
    errorRetry: { maxNumRetry: 1, retryDelayMs: 500, maxRetryDelayMs: 1_000 },
  },
};

/**
 * La configuration hls.js d'un aperçu — LA MEILLEURE QUALITÉ POSSIBLE :
 * aucun plafond à la taille de la mini-carte (`capLevelToPlayerSize: false`,
 * ni à la cadence), départ au niveau le plus haut (posé au manifeste, cf.
 * `topLevel`), l'ABR ne descend que si le débit mesuré l'impose. Un tampon
 * court : un aperçu peut s'arrêter à tout instant, rien ne sert d'en charger
 * une minute d'avance.
 */
export function previewHlsConfig(): Partial<HlsConfig> {
  return {
    autoStartLoad: false,
    startPosition: 0,
    capLevelToPlayerSize: false,
    capLevelOnFPSDrop: false,
    enableWorker: true,
    lowLatencyMode: false,
    testBandwidth: false,
    abrEwmaDefaultEstimate: PREVIEW_START_BANDWIDTH_ESTIMATE,
    maxBufferLength: 12,
    maxMaxBufferLength: 30,
    backBufferLength: 0,
    startFragPrefetch: true,
    // Pas de sous-titres dans un aperçu.
    renderTextTracksNatively: false,
    enableWebVTT: false,
    enableIMSC1: false,
    enableCEA708Captions: false,
    manifestLoadPolicy: PREVIEW_LOAD_POLICY,
    playlistLoadPolicy: PREVIEW_LOAD_POLICY,
    fragLoadPolicy: PREVIEW_LOAD_POLICY,
  };
}

/** L'index hls.js du niveau le plus haut (hauteur, puis débit) — hls.js les trie déjà, on ne le suppose pas. */
export function topLevel(levels: ReadonlyArray<{ height?: number; bitrate?: number }>): number {
  let best = -1;
  levels.forEach((level, index) => {
    const current = best >= 0 ? levels[best] : undefined;
    const taller = (level.height ?? 0) - (current?.height ?? -1);
    if (best < 0 || taller > 0 || (taller === 0 && (level.bitrate ?? 0) > (current?.bitrate ?? 0))) best = index;
  });
  return best;
}

export interface PreviewSourceHandlers {
  /** La première image est décodée (et présentée, quand le navigateur sait le dire). */
  onReady: () => void;
  /** Échec fatal : réseau, média, format illisible. */
  onError: () => void;
  /** L'instance hls.js vient d'être créée (mesures du banc, en développement seulement). */
  onHls?: (hls: Hls) => void;
}

export interface PreviewSourceSession {
  /** hls.js de la session, s'il y en a un (mesures du banc). */
  hls(): Hls | null;
  release(): void;
}

/** Après `loadeddata`, au plus ce délai pour qu'une image soit présentée (élément invisible : jamais). */
const FRAME_PRESENTED_FALLBACK_MS = 200;

/**
 * Pose `stream` sur `video` et rend la session. `loadHls` : injecté par les
 * tests (un faux hls.js) ; l'app prend `loadPreviewHls`.
 */
export function attachPreviewSource(
  video: HTMLVideoElement,
  stream: TrailerPreviewStream,
  handlers: PreviewSourceHandlers,
  loadHls: () => Promise<HlsClass> = loadPreviewHls,
): PreviewSourceSession {
  let released = false;
  let ready = false;
  let hls: Hls | null = null;
  let frameCallback: number | null = null;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;

  const fail = () => {
    if (!released) handlers.onError();
  };
  const markReady = () => {
    if (released || ready) return;
    ready = true;
    if (fallbackTimer !== null) clearTimeout(fallbackTimer);
    handlers.onReady();
  };
  // `loadeddata` : la première image est décodée. `requestVideoFrameCallback` dit
  // quand elle est PRÉSENTÉE ; une vidéo cachée par `display: none` n'en présente
  // aucune, d'où le repli à 200 ms.
  const onLoadedData = () => {
    if (ready) return;
    if (typeof video.requestVideoFrameCallback === "function") {
      frameCallback = video.requestVideoFrameCallback(() => markReady());
      fallbackTimer = setTimeout(markReady, FRAME_PRESENTED_FALLBACK_MS);
    } else {
      markReady();
    }
  };
  video.addEventListener("loadeddata", onLoadedData);
  video.addEventListener("error", fail);

  const playNatively = () => {
    video.src = stream.src;
    video.load();
  };
  const nativeSupport = video.canPlayType(stream.mimeType) !== "";
  if (stream.kind === "hls") {
    // hls.js d'abord, même là où le navigateur lit le HLS seul : lui seul laisse
    // choisir la qualité de départ. L'élément seul en dernier recours (Safari ancien).
    void loadHls().then((HlsCtor) => {
      if (released) return;
      if (!HlsCtor.isSupported()) {
        if (nativeSupport) playNatively();
        else fail();
        return;
      }
      const instance = new HlsCtor(previewHlsConfig());
      hls = instance;
      handlers.onHls?.(instance);
      instance.on(HlsCtor.Events.MANIFEST_PARSED, (_event, data) => {
        const top = topLevel(data.levels);
        if (top >= 0) instance.startLevel = top;
        instance.startLoad(0);
      });
      instance.on(HlsCtor.Events.ERROR, (_event, data) => {
        if (data.fatal) fail();
      });
      instance.loadSource(stream.src);
      instance.attachMedia(video);
    }, fail);
  } else if (nativeSupport) {
    playNatively();
  } else {
    queueMicrotask(fail);
  }

  return {
    hls: () => hls,
    release() {
      if (released) return;
      released = true;
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("error", fail);
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
      if (frameCallback !== null && typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(frameCallback);
      }
      // Rien ne doit plus consommer : hls.js détruit, l'élément vidé de sa source.
      hls?.destroy();
      hls = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    },
  };
}
