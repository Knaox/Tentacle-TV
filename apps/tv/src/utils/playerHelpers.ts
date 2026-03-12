import type { MediaStream as JfStream } from "@tentacle-tv/shared";

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
