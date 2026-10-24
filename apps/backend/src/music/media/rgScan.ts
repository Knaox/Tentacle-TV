/**
 * Octave — OÙ sont les tags d'un fichier audio, lu par PLAGES (le cœur ne
 * voit pas les fichiers : il les demande à Jellyfin). Pur : on lui donne des
 * octets et leur position dans le fichier ; il rend la ReplayGain, ou la
 * prochaine plage à lire.
 *
 * - FLAC : blocs de métadonnées en tête (VORBIS_COMMENT, type 4).
 * - Ogg (Opus, Vorbis) : le deuxième paquet (« OpusTags », « \x03vorbis »).
 * - MP3 : ID3v2 en tête.
 * - MP4 (ALAC, AAC) : l'atome `moov`, en tête ou en fin (on saute `mdat`).
 * - WAV : le bloc `id3 ` après les données (on saute `data`).
 * - DSF : l'ID3v2 au pointeur de métadonnées de l'en-tête.
 */

import type { ReplayGainInfo } from "../contract/musicPlayback";
import { id3Size, id3Tags, mp4FreeformTags, replayGainOf, vorbisComments } from "./rgTags";

export type ScanMode = "start" | "mp4" | "riff" | "id3";

export type TagScan =
  | { done: true; info: ReplayGainInfo | null }
  | { done: false; offset: number; length: number; mode: ScanMode };

const PROBE = 256 * 1024;
const MAX_READ = 8 * 1024 * 1024;
const NONE: TagScan = { done: true, info: null };

function need(offset: number, length: number, mode: ScanMode): TagScan {
  return length > MAX_READ ? NONE : { done: false, offset, length: Math.max(length, 16), mode };
}

function flac(buf: Buffer, base: number): TagScan {
  let p = 4;
  while (p + 4 <= buf.length) {
    const header = buf[p]!;
    const len = buf.readUIntBE(p + 1, 3);
    if ((header & 0x7f) === 4) {
      if (p + 4 + len > buf.length) return need(base, p + 4 + len, "start");
      const tags = vorbisComments(buf, p + 4);
      return { done: true, info: tags ? replayGainOf(tags) : null };
    }
    if (header & 0x80) return NONE;
    p += 4 + len;
  }
  return need(base, p + 64 * 1024, "start");
}

function ogg(buf: Buffer, base: number): TagScan {
  // Les charges utiles des pages, bout à bout : les paquets s'y suivent.
  const parts: Buffer[] = [];
  let p = 0;
  while (p + 27 <= buf.length && buf.toString("latin1", p, p + 4) === "OggS") {
    const segments = buf[p + 26]!;
    if (p + 27 + segments > buf.length) break;
    let size = 0;
    for (let i = 0; i < segments; i++) size += buf[p + 27 + i]!;
    const start = p + 27 + segments;
    if (start + size > buf.length) break;
    parts.push(buf.subarray(start, start + size));
    p = start + size;
  }
  const packets = Buffer.concat(parts);
  for (const [signature, skip] of [["OpusTags", 8], ["\x03vorbis", 7]] as const) {
    const at = packets.indexOf(signature, 0, "latin1");
    if (at < 0) continue;
    const tags = vorbisComments(packets, at + skip);
    if (tags) return { done: true, info: replayGainOf(tags) };
    return buf.length >= MAX_READ ? NONE : need(base, buf.length * 4, "start");
  }
  return buf.length >= 4 * PROBE ? NONE : need(base, buf.length * 4, "start");
}

function id3At(buf: Buffer, base: number): TagScan {
  const size = id3Size(buf);
  if (size === null) return NONE;
  if (size > buf.length) return need(base, size, "id3");
  return { done: true, info: replayGainOf(id3Tags(buf)) };
}

/** Des atomes MP4 de premier niveau, à partir de `from` (relatif au tampon). */
function mp4(buf: Buffer, base: number, from: number): TagScan {
  let p = from;
  while (p + 8 <= buf.length) {
    let size = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    if (size === 1 && p + 16 <= buf.length) size = Number(buf.readBigUInt64BE(p + 8));
    if (size < 8) return NONE;
    if (type === "moov") {
      if (p + size > buf.length) return need(base + p, size, "mp4");
      return { done: true, info: replayGainOf(mp4FreeformTags(buf.subarray(p, p + size))) };
    }
    if (p + size > buf.length) return need(base + p + size, PROBE, "mp4");
    p += size;
  }
  return p >= buf.length ? need(base + p, PROBE, "mp4") : NONE;
}

/** Des blocs RIFF (WAV), à partir de `from` (relatif au tampon). */
function riff(buf: Buffer, base: number, from: number): TagScan {
  let p = from;
  while (p + 8 <= buf.length) {
    const id = buf.toString("latin1", p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    const next = p + 8 + size + (size % 2);
    if (id === "id3 " || id === "ID3 ") {
      if (p + 8 + size > buf.length) return need(base + p, 8 + size, "riff");
      return { done: true, info: replayGainOf(id3Tags(buf, p + 8)) };
    }
    if (next > buf.length) return need(base + next, PROBE, "riff");
    p = next;
  }
  return NONE;
}

function dsf(buf: Buffer, base: number): TagScan {
  if (buf.length < 28) return need(base, 28, "start");
  const pointer = Number(buf.readBigUInt64LE(20));
  return pointer > 0 ? need(pointer, PROBE, "id3") : NONE;
}

/** `buf` = les octets lus à partir de `base` dans le fichier, lus dans le mode demandé. */
export function scanReplayGain(buf: Buffer, base = 0, mode: ScanMode = "start"): TagScan {
  if (mode === "mp4") return mp4(buf, base, 0);
  if (mode === "riff") return riff(buf, base, 0);
  if (mode === "id3") return id3At(buf, base);
  const magic = buf.toString("latin1", 0, 4);
  if (magic === "fLaC") return flac(buf, base);
  if (magic === "OggS") return ogg(buf, base);
  if (magic === "DSD ") return dsf(buf, base);
  if (magic === "RIFF" && buf.toString("latin1", 8, 12) === "WAVE") return riff(buf, base, 12);
  if (buf.toString("latin1", 0, 3) === "ID3") {
    // Un FLAC peut porter une étiquette ID3 devant lui : on la saute.
    const size = id3Size(buf);
    if (size !== null && size + 4 <= buf.length && buf.toString("latin1", size, size + 4) === "fLaC") return flac(buf.subarray(size), base + size);
    return id3At(buf, base);
  }
  if (buf.toString("latin1", 4, 8) === "ftyp") return mp4(buf, base, 0);
  return NONE;
}

export const RG_PROBE_BYTES = PROBE;
