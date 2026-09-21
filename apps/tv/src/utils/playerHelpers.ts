import type { MediaStream as JfStream } from "@tentacle-tv/shared";

/** Reprise tvOS : le fragment `#tnt-start=<sec>` (AVPlayer ne lit pas les fragments) porte la position
 *  absolue de reprise. On le parse puis on le retire de l'URI. Cf. AVPlayerSurface (timeline absolue).
 *  Décimal accepté : une position de reprise n'est pas forcément entière, et un entier tronqué
 *  décalerait la timeline d'une fraction de seconde à chaque reload. */
const START_RE = /#tnt-start=(-?[\d.]+)/;
export function parseStart(source: string): { uri: string; startSec: number } {
  const m = source.match(START_RE);
  if (!m) return { uri: source, startSec: 0 };
  const parsed = Number.parseFloat(m[1]);
  return { uri: source.replace(START_RE, ""), startSec: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 };
}

/** Hermes has no crypto.randomUUID — simple v4 fallback */
export function randomSessionId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function formatTrackLabel(s: JfStream): string {
  const title = s.DisplayTitle || s.Title || s.Language || `Track ${s.Index}`;
  const codec = s.Codec?.toUpperCase();
  return codec && !title.toUpperCase().includes(codec) ? `${title} (${codec})` : title;
}

/**
 * La cadence du flux vidéo, pour caler le téléviseur dessus (Android TV).
 * `RealFrameRate` d'abord (exacte), `AverageFrameRate` en repli. Les valeurs
 * aberrantes sont refusées : mieux vaut ne rien basculer que basculer de travers.
 */
export function videoFrameRate(streams: JfStream[]): number | undefined {
  const video = streams.find((s) => s.Type === "Video");
  const fps = video?.RealFrameRate ?? video?.AverageFrameRate;
  return typeof fps === "number" && fps >= 5 && fps <= 480 ? fps : undefined;
}
