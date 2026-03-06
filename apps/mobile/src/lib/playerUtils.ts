import type { MediaStream as JfStream } from "@tentacle-tv/shared";

/** Hermes doesn't have crypto.randomUUID — simple v4 UUID fallback */
export function randomUUID(): string {
  const hex = "0123456789abcdef";
  let id = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) { id += "-"; continue; }
    if (i === 14) { id += "4"; continue; }
    const r = (Math.random() * 16) | 0;
    id += hex[i === 19 ? (r & 0x3) | 0x8 : r];
  }
  return id;
}

export function formatTrackLabel(s: JfStream): string {
  const title = s.DisplayTitle || s.Title || s.Language || `Track ${s.Index}`;
  const codec = s.Codec?.toUpperCase();
  return codec && !title.toUpperCase().includes(codec) ? `${title} (${codec})` : title;
}
