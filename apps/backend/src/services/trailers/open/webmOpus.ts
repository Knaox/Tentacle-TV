/* ------------------------------------------------------------------ */
/*  L'audio Opus de YouTube (WebM), rendu lisible par un lecteur HLS   */
/*                                                                     */
/*  YouTube ne met dans son maître HLS que de l'AAC. Son Opus est un   */
/*  fichier WebM à part (formats 249 à 251), indexé en tête (Cues,     */
/*  une grappe toutes les dix secondes) : on en lit l'index, puis      */
/*  chaque tranche de grappes est RÉEMBALLÉE en MP4 fragmenté — les    */
/*  paquets Opus recopiés tels quels, aucun réencodage, aucun outil    */
/*  (ni ffmpeg ni autre : rien de plus dans l'image). hls.js le lit    */
/*  comme une piste audio ordinaire, synchronisée par lui.             */
/*                                                                     */
/*  Module pur : des octets en entrée, des octets en sortie.           */
/* ------------------------------------------------------------------ */

/** L'horloge d'Opus : toujours 48 kHz, quel que soit l'échantillonnage d'origine. */
export const OPUS_TIMESCALE = 48_000;

export interface OpusCue {
  /** Le début de la grappe, en secondes. */
  timeS: number;
  /** Sa place dans le FICHIER (octet de son en-tête). */
  offset: number;
}

export interface OpusIndex {
  /** `OpusHead` tel que le WebM le porte (CodecPrivate). */
  head: Uint8Array;
  channels: number;
  trackNumber: number;
  /** Nanosecondes par unité de temps des grappes (1 000 000 : la milliseconde). */
  timecodeScaleNs: number;
  durationS: number;
  /** Les grappes, dans l'ordre ; la première commence là où finit la tête. */
  cues: OpusCue[];
  totalSize: number;
}

const ID = {
  ebml: 0x1a45dfa3, segment: 0x18538067, info: 0x1549a966, timecodeScale: 0x2ad7b1, duration: 0x4489,
  tracks: 0x1654ae6b, trackEntry: 0xae, trackNumber: 0xd7, codecId: 0x86, codecPrivate: 0x63a2,
  audio: 0xe1, channels: 0x9f, cues: 0x1c53bb6b, cuePoint: 0xbb, cueTime: 0xb3, cueTrackPositions: 0xb7,
  cueClusterPosition: 0xf1, cluster: 0x1f43b675, timecode: 0xe7, simpleBlock: 0xa3, blockGroup: 0xa0, block: 0xa1,
} as const;

interface Element {
  id: number;
  /** Début des données. */
  start: number;
  /** Taille des données ; `-1` : inconnue (jusqu'au bout du parent). */
  size: number;
}

/** Lit l'en-tête d'un élément EBML à `at` ; `null` s'il dépasse les octets présents. */
function readElement(bytes: Uint8Array, at: number): Element | null {
  if (at >= bytes.length) return null;
  const first = bytes[at];
  const idLength = first >= 0x80 ? 1 : first >= 0x40 ? 2 : first >= 0x20 ? 3 : first >= 0x10 ? 4 : 0;
  if (idLength === 0 || at + idLength >= bytes.length) return null;
  let id = 0;
  for (let i = 0; i < idLength; i++) id = id * 256 + bytes[at + i];
  const sizeAt = at + idLength;
  const lead = bytes[sizeAt];
  let sizeLength = 1;
  while (sizeLength <= 8 && !(lead & (0x80 >> (sizeLength - 1)))) sizeLength++;
  if (sizeLength > 8 || sizeAt + sizeLength > bytes.length) return null;
  let size = lead & (0xff >> sizeLength);
  let unknown = size === 0xff >> sizeLength;
  for (let i = 1; i < sizeLength; i++) {
    const byte = bytes[sizeAt + i];
    if (byte !== 0xff) unknown = false;
    size = size * 256 + byte;
  }
  return { id, start: sizeAt + sizeLength, size: unknown ? -1 : size };
}

/** Les enfants directs présents dans `[start, end)` — un enfant tronqué arrête la lecture. */
function* children(bytes: Uint8Array, start: number, end: number): Generator<Element> {
  let at = start;
  while (at < end) {
    const element = readElement(bytes, at);
    if (!element) return;
    yield element;
    if (element.size < 0) return;
    at = element.start + element.size;
  }
}

function uint(bytes: Uint8Array, e: Element): number {
  let value = 0;
  for (let i = 0; i < e.size && e.start + i < bytes.length; i++) value = value * 256 + bytes[e.start + i];
  return value;
}

function float(bytes: Uint8Array, e: Element): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset + e.start, e.size);
  return e.size === 4 ? view.getFloat32(0) : e.size === 8 ? view.getFloat64(0) : 0;
}

const endOf = (bytes: Uint8Array, e: Element, parentEnd: number) => (e.size < 0 ? parentEnd : Math.min(e.start + e.size, bytes.length));

/**
 * L'index d'un WebM Opus d'après sa TÊTE (les premiers Ko du fichier : tout ce
 * qui précède la première grappe). `null` : pas un WebM Opus indexé — pas de
 * piste Opus seule, pas de Cues, ou tête trop courte pour les contenir.
 */
export function parseOpusHead(bytes: Uint8Array, totalSize: number): OpusIndex | null {
  const top = [...children(bytes, 0, bytes.length)];
  const segment = top.find((e) => e.id === ID.segment);
  if (top[0]?.id !== ID.ebml || !segment) return null;
  const segmentEnd = endOf(bytes, segment, bytes.length);
  let timecodeScaleNs = 1_000_000;
  let durationUnits = 0;
  let track: { number: number; head: Uint8Array; channels: number } | null = null;
  const positions: Array<{ time: number; position: number }> = [];
  let sawCluster = false;
  for (const part of children(bytes, segment.start, segmentEnd)) {
    const partEnd = endOf(bytes, part, segmentEnd);
    if (part.id === ID.cluster) {
      sawCluster = true;
      break;
    }
    // Une partie coupée par la fin de la tête lue : son contenu serait incomplet.
    if (part.size < 0 || part.start + part.size > bytes.length) return null;
    if (part.id === ID.info) {
      for (const e of children(bytes, part.start, partEnd)) {
        if (e.id === ID.timecodeScale) timecodeScaleNs = uint(bytes, e);
        if (e.id === ID.duration) durationUnits = float(bytes, e);
      }
    } else if (part.id === ID.tracks) {
      for (const entry of children(bytes, part.start, partEnd)) {
        if (entry.id !== ID.trackEntry) continue;
        let number = 0, codec = "", channels = 2;
        let head: Uint8Array | null = null;
        for (const e of children(bytes, entry.start, entry.start + entry.size)) {
          if (e.id === ID.trackNumber) number = uint(bytes, e);
          if (e.id === ID.codecId) codec = Buffer.from(bytes.subarray(e.start, e.start + e.size)).toString("latin1");
          if (e.id === ID.codecPrivate) head = bytes.slice(e.start, e.start + e.size);
          if (e.id === ID.audio) for (const a of children(bytes, e.start, e.start + e.size)) if (a.id === ID.channels) channels = uint(bytes, a);
        }
        if (codec === "A_OPUS" && head && head.length >= 19 && Buffer.from(head.subarray(0, 8)).toString("latin1") === "OpusHead") {
          if (track) return null;  // deux pistes Opus : on ne devine pas laquelle
          track = { number, head, channels: head[9] || channels };
        }
      }
    } else if (part.id === ID.cues) {
      for (const point of children(bytes, part.start, partEnd)) {
        if (point.id !== ID.cuePoint) continue;
        let time = -1, position = -1;
        for (const e of children(bytes, point.start, point.start + point.size)) {
          if (e.id === ID.cueTime) time = uint(bytes, e);
          if (e.id === ID.cueTrackPositions) {
            for (const p of children(bytes, e.start, e.start + e.size)) if (p.id === ID.cueClusterPosition) position = uint(bytes, p);
          }
        }
        if (time >= 0 && position >= 0) positions.push({ time, position });
      }
    }
  }
  if (!track || positions.length === 0 || !sawCluster || timecodeScaleNs <= 0) return null;
  const unitS = timecodeScaleNs / 1e9;
  const cues = positions
    .map((p) => ({ timeS: p.time * unitS, offset: segment.start + p.position }))
    .sort((a, b) => a.offset - b.offset)
    .filter((cue, i, all) => i === 0 || cue.offset > all[i - 1].offset);
  if (cues[cues.length - 1].offset >= totalSize) return null;
  const durationS = durationUnits > 0 ? durationUnits * unitS : cues[cues.length - 1].timeS;
  return { head: track.head, channels: track.channels, trackNumber: track.number, timecodeScaleNs, durationS, cues, totalSize };
}

/** La durée d'un paquet Opus en échantillons à 48 kHz, d'après son octet TOC (RFC 6716 § 3.1). */
export function opusPacketSamples(packet: Uint8Array): number {
  if (packet.length === 0) return 0;
  const config = packet[0] >> 3;
  const frameSamples = config < 12 ? [480, 960, 1920, 2880][config & 3] : config < 16 ? [480, 960][config & 1] : [120, 240, 480, 960][config & 3];
  const code = packet[0] & 3;
  const frames = code === 0 ? 1 : code === 3 ? (packet.length > 1 ? packet[1] & 0x3f : 0) : 2;
  return frames * frameSamples;
}

export interface OpusPacket {
  /** Son instant, en échantillons à 48 kHz. */
  time: number;
  data: Uint8Array;
}

/**
 * Les paquets Opus d'une suite de grappes ENTIÈRES (`bytes` commence sur un
 * en-tête de grappe). `null` : octets qui ne sont pas des grappes, ou paquets
 * lacés (YouTube n'en écrit pas) — on ne sert rien plutôt qu'un son décalé.
 */
export function clusterPackets(bytes: Uint8Array, index: Pick<OpusIndex, "trackNumber" | "timecodeScaleNs">): OpusPacket[] | null {
  const packets: OpusPacket[] = [];
  const perUnit = (index.timecodeScaleNs / 1e9) * OPUS_TIMESCALE;
  let sawCluster = false;
  for (const cluster of children(bytes, 0, bytes.length)) {
    if (cluster.id !== ID.cluster) return sawCluster ? packets : null;
    sawCluster = true;
    const end = endOf(bytes, cluster, bytes.length);
    let base = 0;
    const block = (e: Element): boolean => {
      // Numéro de piste (vint d'un octet pour une piste < 127), temps relatif signé, drapeaux.
      const lead = bytes[e.start];
      if (!(lead & 0x80) || e.size < 4) return false;
      if ((lead & 0x7f) !== index.trackNumber) return true;
      if (bytes[e.start + 3] & 0x06) return false;  // lacé
      const relative = (bytes[e.start + 1] << 24 >> 16) | bytes[e.start + 2];
      packets.push({ time: Math.round((base + relative) * perUnit), data: bytes.subarray(e.start + 4, e.start + e.size) });
      return true;
    };
    for (const e of children(bytes, cluster.start, end)) {
      if (e.size < 0 || e.start + e.size > bytes.length) return null;
      if (e.id === ID.timecode) base = uint(bytes, e);
      else if (e.id === ID.simpleBlock) {
        if (!block(e)) return null;
      } else if (e.id === ID.blockGroup) {
        for (const inner of children(bytes, e.start, e.start + e.size)) if (inner.id === ID.block && !block(inner)) return null;
      }
    }
  }
  return sawCluster ? packets : null;
}
