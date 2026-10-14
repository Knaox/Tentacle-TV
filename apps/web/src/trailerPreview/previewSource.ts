import type Hls from "hls.js";
import type { HlsConfig, LevelDetails } from "hls.js";
import { TRAILER_PREVIEW_TIMING } from "@tentacle-tv/shared";
import { capLevelFor, type BoxSize } from "./previewLevelCap";
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

/**
 * Le module hls.js, chargé une fois — dès l'intention (`useTrailerPreview`),
 * pendant que le serveur vérifie la bande-annonce. Un chargement raté (réseau
 * du web) n'est pas retenu : le suivant réessaie.
 */
export function loadPreviewHls(): Promise<HlsClass> {
  hlsLoading ??= import("hls.js").then(
    (module) => module.default,
    (error: unknown) => {
      hlsLoading = null;
      throw error;
    },
  );
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
 * Le tampon d'avance : AVANT la révélation, une seconde — le premier segment
 * (celui que le serveur a lu d'avance), rien de plus : un survol qui s'arrête
 * avant la révélation n'a pas téléchargé trente secondes de 1080p. Une fois
 * montrée (`unleash`), douze secondes, quinze au plus (hls.js porte sinon le
 * tampon à 60 Mo, soit trente secondes, quel que soit `maxBufferLength`).
 */
export const PREVIEW_PRELOAD_BUFFER_S = 1;
export const PREVIEW_PLAY_BUFFER_S = 12;
export const PREVIEW_PLAY_MAX_BUFFER_S = 15;

/**
 * La configuration hls.js d'un aperçu. La qualité est celle de la BOÎTE :
 * départ et plafond au plus petit niveau qui couvre la mini-carte en pixels
 * de l'écran (`previewLevelCap.ts`, posé au manifeste et suivi si la boîte
 * change) — le plafond automatique de hls.js (`capLevelToPlayerSize`) lirait
 * la boîte encore réduite de l'animation d'entrée. L'ABR ne descend sous ce
 * plafond que si le débit mesuré l'impose. Un tampon court (cf. plus haut).
 */
export function previewHlsConfig(): Partial<HlsConfig> {
  return {
    autoStartLoad: false,
    startPosition: TRAILER_PREVIEW_TIMING.startOffsetS,
    capLevelToPlayerSize: false,
    capLevelOnFPSDrop: false,
    enableWorker: true,
    lowLatencyMode: false,
    testBandwidth: false,
    abrEwmaDefaultEstimate: PREVIEW_START_BANDWIDTH_ESTIMATE,
    maxBufferLength: PREVIEW_PRELOAD_BUFFER_S,
    maxMaxBufferLength: PREVIEW_PRELOAD_BUFFER_S,
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

/**
 * Le départ décalé (`startOffsetS`) vaut-il pour cette liste ? Non pour une
 * vidéo courte, ni quand le premier segment — le seul que le serveur lit
 * d'avance — ne le contient pas avec une marge : la première image attendrait
 * un segment de plus.
 */
export function keepsStartOffset(details: Pick<LevelDetails, "totalduration" | "fragments">): boolean {
  const { startOffsetS, startOffsetMinDurationS } = TRAILER_PREVIEW_TIMING;
  const first = details.fragments[0];
  return details.totalduration >= startOffsetMinDurationS && first !== undefined && first.duration >= startOffsetS + 0.5;
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
  /** L'aperçu se montre : le tampon d'avance passe du premier segment à douze secondes. */
  unleash(): void;
  /** La vidéo est rognée de son letterbox (`videoCrop`) : le plafond suit la boîte agrandie d'autant. */
  setCrop(scale: number): void;
  release(): void;
}

/** La boîte de la vidéo en px CSS — sa taille de MISE EN PAGE, que l'échelle de l'animation ne change pas. */
/** `crop` : l'échelle du rognage du letterbox — la source s'affiche d'autant plus grande. */
function boxOf(video: HTMLVideoElement, crop = 1): BoxSize {
  return { width: video.clientWidth * crop, height: video.clientHeight * crop };
}

const pixelRatio = () => (typeof window !== "undefined" && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

/** Après `loadeddata`, au plus ce délai si les images d'animation ne passent pas (page bridée). */
const FRAME_PRESENTED_FALLBACK_MS = 100;

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
  let unleashed = false;
  let crop = 1;
  let hls: Hls | null = null;
  let resizeWatch: ResizeObserver | null = null;
  let frameRequest: number | null = null;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  const widenBuffer = () => {
    if (!hls) return;
    hls.config.maxBufferLength = PREVIEW_PLAY_BUFFER_S;
    hls.config.maxMaxBufferLength = PREVIEW_PLAY_MAX_BUFFER_S;
  };

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
  // `loadeddata` : la première image est décodée ; deux images d'animation plus
  // tard, elle est composée. PAS `requestVideoFrameCallback` : il attend l'image
  // SUIVANTE, qui ne vient jamais d'une vidéo en pause — mesuré dans Electron,
  // à toute opacité ; on payait les 200 ms de repli à chaque aperçu.
  const onLoadedData = () => {
    if (ready) return;
    if (typeof requestAnimationFrame === "function") {
      frameRequest = requestAnimationFrame(() => {
        frameRequest = requestAnimationFrame(() => markReady());
      });
    }
    fallbackTimer = setTimeout(markReady, FRAME_PRESENTED_FALLBACK_MS);
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
      if (unleashed) widenBuffer();
      instance.on(HlsCtor.Events.MANIFEST_PARSED, (_event, data) => {
        // Départ ET plafond : le plus petit niveau qui couvre la boîte (`previewLevelCap.ts`).
        const cap = capLevelFor(data.levels, boxOf(video), pixelRatio());
        if (cap >= 0) instance.autoLevelCapping = cap;
        const start = cap >= 0 ? cap : topLevel(data.levels);
        if (start >= 0) instance.startLevel = start;
        instance.startLoad(TRAILER_PREVIEW_TIMING.startOffsetS);
        // La boîte change (fenêtre redimensionnée) : le plafond la suit.
        if (cap >= 0 && typeof ResizeObserver === "function") {
          resizeWatch = new ResizeObserver(() => {
            if (!released) instance.autoLevelCapping = capLevelFor(instance.levels, boxOf(video, crop), pixelRatio());
          });
          resizeWatch.observe(video);
        }
      });
      // La liste de départ dit la durée et le premier segment : départ à 0 si le
      // décalage ne tient pas (cf. `keepsStartOffset`), avant le moindre ajout.
      let startChecked = false;
      instance.on(HlsCtor.Events.LEVEL_LOADED, (_event, data) => {
        if (startChecked) return;
        startChecked = true;
        if (!keepsStartOffset(data.details)) {
          instance.stopLoad();
          instance.startLoad(0);
        }
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
    unleash() {
      unleashed = true;
      widenBuffer();
    },
    setCrop(scale) {
      crop = scale > 1 ? scale : 1;
      if (hls && hls.levels.length > 0 && !released) hls.autoLevelCapping = capLevelFor(hls.levels, boxOf(video, crop), pixelRatio());
    },
    release() {
      if (released) return;
      released = true;
      resizeWatch?.disconnect();
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("error", fail);
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
      if (frameRequest !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameRequest);
      // Rien ne doit plus consommer : hls.js détruit, l'élément vidé de sa source.
      hls?.destroy();
      hls = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    },
  };
}
