/**
 * La ReplayGain lue des tags, conteneur par conteneur, sur des octets
 * fabriqués ici (les mêmes structures que les fichiers du banc Octave).
 */

import { describe, expect, it } from "vitest";
import { scanReplayGain, type TagScan } from "./rgScan";
import { parseGain, replayGainOf } from "./rgTags";

const TAGS = ["REPLAYGAIN_TRACK_GAIN=+4.50 dB", "REPLAYGAIN_TRACK_PEAK=0.142889", "REPLAYGAIN_ALBUM_GAIN=-0.70 dB", "REPLAYGAIN_ALBUM_PEAK=0.389045"];
const EXPECTED = { trackGainDb: 4.5, trackPeak: 0.142889, albumGainDb: -0.7, albumPeak: 0.389045 };

function u32le(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}
function u32be(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
}
function vorbis(entries: string[]): Buffer {
  return Buffer.concat([u32le(6), Buffer.from("vendor"), u32le(entries.length), ...entries.flatMap((e) => [u32le(Buffer.byteLength(e)), Buffer.from(e)])]);
}
function flac(entries: string[]): Buffer {
  const streaminfo = Buffer.concat([Buffer.from([0x00, 0, 0, 34]), Buffer.alloc(34)]);
  const body = vorbis(entries);
  const header = Buffer.from([0x84, (body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255]);
  return Buffer.concat([Buffer.from("fLaC"), streaminfo, header, body, Buffer.alloc(64)]);
}
function syncsafe(n: number): Buffer {
  return Buffer.from([(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127]);
}
function id3(entries: string[]): Buffer {
  const frames = entries.map((e) => {
    const [desc, value] = e.split("=");
    const body = Buffer.concat([Buffer.from([3]), Buffer.from(`${desc}\0${value}`, "utf8")]);
    return Buffer.concat([Buffer.from("TXXX"), syncsafe(body.length), Buffer.alloc(2), body]);
  });
  const all = Buffer.concat(frames);
  return Buffer.concat([Buffer.from("ID3"), Buffer.from([4, 0, 0]), syncsafe(all.length), all]);
}
function box(type: string, ...children: Buffer[]): Buffer {
  const body = Buffer.concat(children);
  return Buffer.concat([u32be(8 + body.length), Buffer.from(type, "latin1"), body]);
}
function freeform(name: string, value: string): Buffer {
  return box("----", box("mean", Buffer.alloc(4), Buffer.from("com.apple.iTunes")), box("name", Buffer.alloc(4), Buffer.from(name)), box("data", Buffer.from([0, 0, 0, 1]), Buffer.alloc(4), Buffer.from(value)));
}
function mp4(moovFirst: boolean): Buffer {
  const moov = box("moov", box("udta", box("meta", Buffer.alloc(4), box("ilst", ...TAGS.map((t) => freeform(t.split("=")[0]!.toLowerCase(), t.split("=")[1]!))))));
  const mdat = box("mdat", Buffer.alloc(300_000));
  const ftyp = box("ftyp", Buffer.from("M4A \0\0\0\0"));
  return Buffer.concat(moovFirst ? [ftyp, moov, mdat] : [ftyp, mdat, moov]);
}

/** Lit le « fichier » par plages comme le fait le lecteur de tags (au plus 5 lectures). */
function readAll(file: Buffer): { scan: TagScan; reads: number } {
  let scan = scanReplayGain(file.subarray(0, 256 * 1024), 0, "start");
  let reads = 1;
  while (!scan.done && reads < 5) {
    scan = scanReplayGain(file.subarray(scan.offset, scan.offset + scan.length), scan.offset, scan.mode);
    reads++;
  }
  return { scan, reads };
}

describe("ReplayGain des tags", () => {
  it("FLAC : le bloc VORBIS_COMMENT", () => {
    expect(readAll(flac(TAGS)).scan).toEqual({ done: true, info: EXPECTED });
  });

  it("MP3 : les TXXX d'ID3v2.4", () => {
    expect(readAll(Buffer.concat([id3(TAGS), Buffer.alloc(1000)])).scan).toEqual({ done: true, info: EXPECTED });
  });

  it("MP4 : les atomes libres, moov en tête ou APRÈS mdat (saut)", () => {
    expect(readAll(mp4(true)).scan).toEqual({ done: true, info: EXPECTED });
    const late = readAll(mp4(false));
    expect(late.scan).toEqual({ done: true, info: EXPECTED });
    expect(late.reads).toBe(2);
  });

  it("WAV : le bloc id3 après les données", () => {
    const data = Buffer.concat([Buffer.from("data"), u32le(400_000), Buffer.alloc(400_000)]);
    const tag = id3(TAGS);
    const chunk = Buffer.concat([Buffer.from("id3 "), u32le(tag.length), tag]);
    const body = Buffer.concat([Buffer.from("WAVE"), Buffer.from("fmt "), u32le(16), Buffer.alloc(16), data, chunk]);
    const wav = Buffer.concat([Buffer.from("RIFF"), u32le(body.length), body]);
    expect(readAll(wav).scan).toEqual({ done: true, info: EXPECTED });
  });

  it("Opus : OpusTags, et R128 ramené à −18 LUFS à défaut", () => {
    const tags = Buffer.concat([Buffer.from("OpusTags"), vorbis(["R128_TRACK_GAIN=-1280"])]);
    const head = Buffer.concat([Buffer.from("OpusHead"), Buffer.alloc(11)]);
    const page = (payload: Buffer) => Buffer.concat([Buffer.from("OggS"), Buffer.alloc(22), Buffer.from([1, payload.length]), payload]);
    expect(readAll(Buffer.concat([page(head), page(tags)])).scan).toEqual({ done: true, info: { trackGainDb: 0, trackPeak: null, albumGainDb: null, albumPeak: null } });
  });

  it("DSF : l'ID3 au pointeur de métadonnées ; sans tag, rien", () => {
    const tag = id3(TAGS);
    const head = Buffer.concat([Buffer.from("DSD "), Buffer.alloc(16), Buffer.alloc(8)]);
    head.writeBigUInt64LE(28n + 100_000n, 20);
    expect(readAll(Buffer.concat([head, Buffer.alloc(100_000), tag])).scan).toEqual({ done: true, info: EXPECTED });
    expect(readAll(Buffer.concat([Buffer.from("DSD "), Buffer.alloc(24)])).scan).toEqual({ done: true, info: null });
  });

  it("rien d'inventé : un format inconnu, des valeurs absurdes", () => {
    expect(scanReplayGain(Buffer.from("not an audio file"))).toEqual({ done: true, info: null });
    expect(parseGain("banane")).toBeNull();
    expect(parseGain("+400 dB")).toBeNull();
    expect(replayGainOf(new Map())).toBeNull();
  });
});
