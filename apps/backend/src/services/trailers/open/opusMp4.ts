/* ------------------------------------------------------------------ */
/*  De l'Opus en MP4 fragmenté (ISO BMFF, « Opus in ISOBMFF »)         */
/*                                                                     */
/*  Le segment d'initialisation (une piste audio `Opus` + `dOps`) et   */
/*  les fragments (`moof` + `mdat`) que hls.js passe tels quels à la   */
/*  source média du navigateur. Les paquets ne sont que recopiés.      */
/*  Module pur.                                                        */
/* ------------------------------------------------------------------ */

import { OPUS_TIMESCALE, opusPacketSamples, type OpusPacket } from "./webmOpus";

const u8 = (...values: number[]) => Buffer.from(values);
const u16 = (value: number) => { const b = Buffer.alloc(2); b.writeUInt16BE(value & 0xffff); return b; };
const u32 = (value: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(value >>> 0); return b; };
const u64 = (value: number) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(Math.max(0, Math.round(value)))); return b; };
const zeros = (count: number) => Buffer.alloc(count);

function box(type: string, ...parts: Uint8Array[]): Buffer {
  const size = 8 + parts.reduce((sum, part) => sum + part.length, 0);
  return Buffer.concat([u32(size), Buffer.from(type, "latin1"), ...parts]);
}

/** Une boîte « pleine » : version et drapeaux d'abord. */
const fullBox = (type: string, version: number, flags: number, ...parts: Uint8Array[]) => box(type, u8(version, (flags >> 16) & 0xff, (flags >> 8) & 0xff, flags & 0xff), ...parts);

/** La matrice identité des en-têtes `mvhd` et `tkhd`. */
const MATRIX = Buffer.concat([u32(0x00010000), zeros(12), u32(0x00010000), zeros(12), u32(0x40000000)]);

/**
 * `dOps` d'après `OpusHead` : les mêmes champs, en gros-boutiste (OpusHead est
 * petit-boutiste), version 0. La table des canaux suit telle quelle quand la
 * famille n'est pas 0 (plus de deux canaux).
 */
function dOps(head: Uint8Array): Buffer {
  const view = new DataView(head.buffer, head.byteOffset, head.length);
  const family = head[18];
  return box(
    "dOps", u8(0, head[9]), u16(view.getUint16(10, true)), u32(view.getUint32(12, true)), u16(view.getUint16(16, true)), u8(family),
    family === 0 ? zeros(0) : head.subarray(19),
  );
}

/** Le segment d'initialisation : une piste audio Opus, sans échantillon. */
export function opusInitSegment(head: Uint8Array): Buffer {
  const channels = head[9];
  const entry = box(
    "Opus", zeros(6), u16(1), zeros(8), u16(channels), u16(16), zeros(4), u32(OPUS_TIMESCALE * 65536), dOps(head),
  );
  const stbl = box(
    "stbl", fullBox("stsd", 0, 0, u32(1), entry), fullBox("stts", 0, 0, u32(0)), fullBox("stsc", 0, 0, u32(0)),
    fullBox("stsz", 0, 0, u32(0), u32(0)), fullBox("stco", 0, 0, u32(0)),
  );
  const minf = box(
    "minf", fullBox("smhd", 0, 0, zeros(4)), box("dinf", fullBox("dref", 0, 0, u32(1), fullBox("url ", 0, 1))), stbl,
  );
  const mdia = box(
    "mdia", fullBox("mdhd", 0, 0, zeros(8), u32(OPUS_TIMESCALE), u32(0), u16(0x55c4), u16(0)),
    fullBox("hdlr", 0, 0, zeros(4), Buffer.from("soun", "latin1"), zeros(12), Buffer.from("Tentacle\0", "latin1")), minf,
  );
  const trak = box(
    "trak", fullBox("tkhd", 0, 3, zeros(8), u32(1), zeros(4), u32(0), zeros(8), u16(0), u16(0), u16(0x0100), u16(0), MATRIX, zeros(8)), mdia,
  );
  const mvhd = fullBox("mvhd", 0, 0, zeros(8), u32(OPUS_TIMESCALE), u32(0), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(2));
  const mvex = box("mvex", fullBox("trex", 0, 0, u32(1), u32(1), u32(0), u32(0), u32(0)));
  const ftyp = box("ftyp", Buffer.from("iso5", "latin1"), u32(1), Buffer.from("iso5iso6mp41", "latin1"));
  return Buffer.concat([ftyp, box("moov", mvhd, trak, mvex)]);
}

/**
 * Un fragment : les paquets, chacun avec sa durée (lue dans son TOC) et sa
 * taille, datés du premier (`tfdt`). `null` sans paquet.
 */
export function opusFragment(packets: readonly OpusPacket[], sequence: number): Buffer | null {
  if (packets.length === 0) return null;
  const samples = Buffer.concat(packets.map((p) => Buffer.concat([u32(opusPacketSamples(p.data)), u32(p.data.length)])));
  // trun : décalage des données, durée et taille par échantillon. Le décalage se compte depuis le début du moof.
  const TRUN_FLAGS = 0x000301;
  const trunSize = 12 + 8 + samples.length;
  const tfhd = fullBox("tfhd", 0, 0x020000, u32(1));
  const tfdt = fullBox("tfdt", 1, 0, u64(packets[0].time));
  const moofSize = 8 + 16 + 8 + tfhd.length + tfdt.length + trunSize;
  const trun = fullBox("trun", 0, TRUN_FLAGS, u32(packets.length), u32(moofSize + 8), samples);
  const moof = box("moof", fullBox("mfhd", 0, 0, u32(sequence)), box("traf", tfhd, tfdt, trun));
  return Buffer.concat([moof, box("mdat", ...packets.map((p) => p.data))]);
}
