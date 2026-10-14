import type Hls from "hls.js";

/**
 * Les mesures d'un aperçu, pour le banc — en développement et dans le build
 * de diagnostic du bureau (`build:web:debug`) SEULEMENT : `__PLAYER_DEBUG__`
 * est faux dans tout build livré, et cette branche disparaît du paquet.
 *
 * `window.__tentaclePreviewBench` garde la DERNIÈRE session : instants clés
 * (pose de la source, première image, lecture), niveau hls.js chargé à chaque
 * fragment (hauteur, débit estimé, position du fragment), position à l'arrêt
 * (la reprise au retour sur la carte). Lu par CDP, jamais affiché.
 */
interface PreviewBenchEntry {
  at: number;
  event: string;
  detail?: Record<string, unknown>;
}

interface PreviewBench {
  video: HTMLVideoElement;
  startedAt: number;
  events: PreviewBenchEntry[];
  hls: Hls | null;
}

const enabled = (() => {
  try {
    return import.meta.env.DEV || (typeof __PLAYER_DEBUG__ !== "undefined" && __PLAYER_DEBUG__);
  } catch {
    return false;
  }
})();

/** Le relevé d'une session neuve ; `record` (et `onHls`) inertes hors développement. */
export function openPreviewBench(video: HTMLVideoElement): {
  record: (event: string, detail?: Record<string, unknown>) => void;
  onHls: ((hls: Hls) => void) | undefined;
  close: () => void;
} {
  if (!enabled || typeof window === "undefined") {
    return { record: () => undefined, onHls: undefined, close: () => undefined };
  }
  const bench: PreviewBench = { video, startedAt: performance.now(), events: [], hls: null };
  const record = (event: string, detail?: Record<string, unknown>) => {
    bench.events.push({ at: Math.round(performance.now() - bench.startedAt), event, detail });
  };
  (window as unknown as { __tentaclePreviewBench?: PreviewBench }).__tentaclePreviewBench = bench;
  const onHls = (hls: Hls) => {
    bench.hls = hls;
    const Events = (hls.constructor as typeof Hls).Events;
    hls.on(Events.MANIFEST_PARSED, (_e, data) => {
      record("manifest", { levels: data.levels.map((l) => `${l.height}p@${Math.round(l.bitrate / 1000)}k`) });
    });
    hls.on(Events.FRAG_LOADED, (_e, data) => {
      // Les fragments audio (piste séparée) ont aussi un `level` : celui de LEUR piste, pas une hauteur.
      const video = data.frag.type === "main";
      record(video ? "frag" : `frag-${data.frag.type}`, {
        level: data.frag.level,
        height: video ? hls.levels[data.frag.level]?.height : undefined,
        kbps: Math.round(hls.bandwidthEstimate / 1000),
        ms: Math.round(data.frag.stats.loading.end - data.frag.stats.loading.start),
        kb: Math.round(data.frag.stats.loaded / 1024),
        start: Math.round(data.frag.start * 10) / 10,
      });
    });
    hls.on(Events.LEVEL_SWITCHED, (_e, data) => record("level", { height: hls.levels[data.level]?.height }));
    hls.on(Events.ERROR, (_e, data) => record("error", { fatal: data.fatal, details: data.details }));
  };
  return { record, onHls, close: () => record("released", { position: Math.round(video.currentTime * 10) / 10 }) };
}
