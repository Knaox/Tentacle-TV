/**
 * Octave — la ReplayGain des TAGS d'un fichier : commentaires Vorbis (FLAC,
 * Ogg Vorbis, Opus), trames ID3v2 `TXXX` (MP3, WAV, DSF), atomes libres MP4
 * (« ----:com.apple.iTunes:replaygain_… », ALAC, AAC). Pur, sur des octets.
 *
 * Valeurs : « +4.50 dB » (gain), « 0.142889 » (crête linéaire). Opus sans
 * REPLAYGAIN_* : `R128_TRACK_GAIN` / `R128_ALBUM_GAIN` (Q7.8, référence
 * −23 LUFS) ramenés à la référence de ReplayGain 2 (−18 LUFS) : +5 dB.
 */

import type { ReplayGainInfo } from "../contract/musicPlayback";

export type TagMap = Map<string, string>;

export function parseGain(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = parseFloat(value.replace(/db/i, "").trim());
  return Number.isFinite(n) && Math.abs(n) < 100 ? Math.round(n * 100) / 100 : null;
}

export function parsePeak(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = parseFloat(value.trim());
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : null;
}

function r128(value: string | undefined): number | null {
  if (value === undefined || !/^-?\d+$/.test(value.trim())) return null;
  return Math.round((parseInt(value, 10) / 256 + 5) * 100) / 100;
}

/** Les tags (clés en MINUSCULES) → la ReplayGain ; `null` si le fichier n'en dit rien. */
export function replayGainOf(tags: TagMap): ReplayGainInfo | null {
  const info: ReplayGainInfo = {
    trackGainDb: parseGain(tags.get("replaygain_track_gain")) ?? r128(tags.get("r128_track_gain")),
    trackPeak: parsePeak(tags.get("replaygain_track_peak")),
    albumGainDb: parseGain(tags.get("replaygain_album_gain")) ?? r128(tags.get("r128_album_gain")),
    albumPeak: parsePeak(tags.get("replaygain_album_peak")),
  };
  return Object.values(info).some((v) => v !== null) ? info : null;
}

/** Un bloc de commentaires Vorbis (sans signature) : fournisseur, puis « CLÉ=valeur ». `null` s'il est tronqué. */
export function vorbisComments(buf: Buffer, start: number): TagMap | null {
  const tags: TagMap = new Map();
  let p = start;
  if (p + 4 > buf.length) return null;
  p += 4 + buf.readUInt32LE(p);
  if (p + 4 > buf.length) return null;
  const count = buf.readUInt32LE(p);
  p += 4;
  for (let i = 0; i < count; i++) {
    if (p + 4 > buf.length) return null;
    const len = buf.readUInt32LE(p);
    p += 4;
    if (p + len > buf.length) return null;
    const entry = buf.toString("utf8", p, p + len);
    p += len;
    const eq = entry.indexOf("=");
    if (eq > 0) tags.set(entry.slice(0, eq).toLowerCase(), entry.slice(eq + 1));
  }
  return tags;
}

function syncsafe(buf: Buffer, p: number): number {
  return ((buf[p]! & 0x7f) << 21) | ((buf[p + 1]! & 0x7f) << 14) | ((buf[p + 2]! & 0x7f) << 7) | (buf[p + 3]! & 0x7f);
}

/** La taille totale d'une étiquette ID3v2 qui commence en `p` (en-tête compris), `null` sinon. */
export function id3Size(buf: Buffer, p = 0): number | null {
  if (buf.length < p + 10 || buf.toString("latin1", p, p + 3) !== "ID3") return null;
  return 10 + syncsafe(buf, p + 6);
}

function decodeText(bytes: Buffer, encoding: number): string[] {
  const text = encoding === 1 || encoding === 2 ? bytes.toString("utf16le") : encoding === 3 ? bytes.toString("utf8") : bytes.toString("latin1");
  return text.replace(/^\uFEFF/, "").split("\0");
}

/** Les `TXXX` d'une étiquette ID3v2.3/2.4 complète, à partir de `p`. */
export function id3Tags(buf: Buffer, p = 0): TagMap {
  const tags: TagMap = new Map();
  const size = id3Size(buf, p);
  if (size === null) return tags;
  const version = buf[p + 3]!;
  const end = Math.min(buf.length, p + size);
  let f = p + 10;
  if (buf[p + 5]! & 0x40) f += version === 4 ? syncsafe(buf, f) : 4 + buf.readUInt32BE(f);
  while (f + 10 <= end) {
    const id = buf.toString("latin1", f, f + 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const len = version === 4 ? syncsafe(buf, f + 4) : buf.readUInt32BE(f + 4);
    const body = f + 10;
    if (len <= 0 || body + len > end) break;
    if (id === "TXXX") {
      const encoding = buf[body]!;
      const [desc, ...rest] = decodeText(buf.subarray(body + 1, body + len), encoding);
      const value = rest.find((s) => s.length > 0);
      if (desc && value !== undefined) tags.set(desc.toLowerCase(), value);
    }
    f = body + len;
  }
  return tags;
}

/** Les atomes libres « ---- » d'un `moov` MP4 complet (cherchés dans udta/meta/ilst). */
export function mp4FreeformTags(moov: Buffer): TagMap {
  const tags: TagMap = new Map();
  const walk = (start: number, end: number, depth: number) => {
    let p = start;
    while (p + 8 <= end) {
      const size = moov.readUInt32BE(p);
      const type = moov.toString("latin1", p + 4, p + 8);
      if (size < 8 || p + size > end) return;
      if (type === "----") readFreeform(p + 8, p + size);
      else if (depth < 6 && ["moov", "udta", "ilst", "trak", "mdia"].includes(type)) walk(p + 8, p + size, depth + 1);
      else if (depth < 6 && type === "meta") walk(p + 12, p + size, depth + 1);
      p += size;
    }
  };
  const readFreeform = (start: number, end: number) => {
    let name: string | null = null;
    let value: string | null = null;
    let p = start;
    while (p + 8 <= end) {
      const size = moov.readUInt32BE(p);
      const type = moov.toString("latin1", p + 4, p + 8);
      if (size < 8 || p + size > end) return;
      if (type === "name") name = moov.toString("utf8", p + 12, p + size);
      if (type === "data") value = moov.toString("utf8", p + 16, p + size);
      p += size;
    }
    if (name && value !== null) tags.set(name.toLowerCase(), value);
  };
  walk(0, moov.length, 0);
  return tags;
}
