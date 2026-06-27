import type { MediaStream as JfStream } from "@tentacle-tv/shared";

/** Reprise tvOS : le fragment `#tnt-start=<sec>` (AVPlayer ne lit pas les fragments) porte la position
 *  absolue de reprise. On le parse puis on le retire de l'URI. Cf. AVPlayerSurface (offset confiné). */
const START_RE = /#tnt-start=(\d+)/;
export function parseStart(source: string): { uri: string; startSec: number } {
  const m = source.match(START_RE);
  if (!m) return { uri: source, startSec: 0 };
  return { uri: source.replace(START_RE, ""), startSec: Number(m[1]) };
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
