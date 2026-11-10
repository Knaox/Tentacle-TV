import { describe, expect, it } from "vitest";
import { opusPlaylist, opusSegmentRange } from "./openAudio";
import { OPUS_WEBM } from "./opusFixture";
import { opusFragment, opusInitSegment } from "./opusMp4";
import { clusterPackets, opusPacketSamples, parseOpusHead } from "./webmOpus";

/** Les boîtes ISO BMFF de premier niveau d'un tampon : [type, taille]. */
function boxes(bytes: Uint8Array, start = 0, end = bytes.length): Array<[string, number, number]> {
  const out: Array<[string, number, number]> = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  for (let at = start; at + 8 <= end;) {
    const size = view.getUint32(at);
    out.push([Buffer.from(bytes.subarray(at + 4, at + 8)).toString("latin1"), at, size]);
    at += size;
  }
  return out;
}
const find = (bytes: Uint8Array, path: string[]): [number, number] => {
  let start = 0, end = bytes.length;
  for (const type of path) {
    const hit = boxes(bytes, start, end).find(([name]) => name === type);
    if (!hit) throw new Error(`boîte ${type} absente`);
    // `stsd` et les boîtes pleines : 4 octets de version/drapeaux (et 4 de compte pour stsd) avant les enfants.
    const header = type === "stsd" ? 16 : 8;
    start = hit[1] + header;
    end = hit[1] + hit[2];
  }
  return [start, end];
};

describe("l'index d'un WebM Opus (webmOpus.ts)", () => {
  const index = parseOpusHead(OPUS_WEBM, OPUS_WEBM.length);

  it("lit la piste, la durée et les grappes de la tête", () => {
    expect(index).not.toBeNull();
    expect(index?.channels).toBe(2);
    expect(index?.trackNumber).toBe(1);
    expect(index?.timecodeScaleNs).toBe(1_000_000);
    expect(index?.durationS).toBeCloseTo(2.408, 2);
    expect(index?.cues.map((cue) => cue.timeS)).toEqual([0, 0.981, 1.981]);
    // Chaque grappe commence bien sur un en-tête de grappe (0x1F43B675).
    for (const cue of index?.cues ?? []) expect([...OPUS_WEBM.subarray(cue.offset, cue.offset + 4)]).toEqual([0x1f, 0x43, 0xb6, 0x75]);
    expect(Buffer.from(index?.head.subarray(0, 8) ?? []).toString("latin1")).toBe("OpusHead");
  });

  it("refuse une tête coupée avant la fin de l'index, et ce qui n'est pas un WebM", () => {
    const firstCluster = index?.cues[0].offset ?? 0;
    expect(parseOpusHead(OPUS_WEBM.subarray(0, firstCluster - 40), OPUS_WEBM.length)).toBeNull();
    expect(parseOpusHead(new Uint8Array([0x47, 0x40, 0x00, 0x10, 1, 2, 3, 4]), 8)).toBeNull();
    expect(parseOpusHead(new Uint8Array(0), 0)).toBeNull();
  });

  it("une tête qui s'arrête juste après l'index suffit (le relais ne lit que 64 Ko)", () => {
    const firstCluster = index?.cues[0].offset ?? 0;
    const head = parseOpusHead(OPUS_WEBM.subarray(0, firstCluster + 12), OPUS_WEBM.length);
    expect(head?.cues).toEqual(index?.cues);
  });

  it("rend les paquets d'une grappe, datés à 48 kHz, et leur durée d'après le TOC", () => {
    if (!index) throw new Error("index");
    const range = opusSegmentRange(index, 0);
    const packets = clusterPackets(OPUS_WEBM.subarray(range?.start, (range?.end ?? 0) + 1), index);
    expect(packets?.length).toBeGreaterThan(40);
    expect(packets?.[0].time).toBe(0);
    // 20 ms par paquet : 960 échantillons, et des instants qui avancent d'autant (à la milliseconde du WebM près).
    for (const packet of packets ?? []) expect(opusPacketSamples(packet.data)).toBe(960);
    const last = packets?.[packets.length - 1].time ?? 0;
    expect(last / 48_000).toBeCloseTo(0.96, 1);
    // La dernière plage va jusqu'au bout du fichier.
    expect(opusSegmentRange(index, 2)?.end).toBe(OPUS_WEBM.length - 1);
    expect(opusSegmentRange(index, 3)).toBeNull();
  });

  it("des octets qui ne sont pas des grappes ne donnent rien", () => {
    if (!index) throw new Error("index");
    expect(clusterPackets(OPUS_WEBM.subarray(0, 64), index)).toBeNull();
    expect(clusterPackets(new Uint8Array(0), index)).toBeNull();
  });

  it("lit la durée des paquets Opus de toutes les familles (RFC 6716)", () => {
    expect(opusPacketSamples(new Uint8Array([0b00001_0_00]))).toBe(960);    // SILK 20 ms, une trame
    expect(opusPacketSamples(new Uint8Array([0b00011_0_01]))).toBe(5760);   // SILK 60 ms, deux trames
    expect(opusPacketSamples(new Uint8Array([0b01101_0_00]))).toBe(960);    // hybride 20 ms
    expect(opusPacketSamples(new Uint8Array([0b10000_0_00]))).toBe(120);    // CELT 2,5 ms
    expect(opusPacketSamples(new Uint8Array([0b11111_0_11, 3]))).toBe(2880); // CELT 20 ms, trois trames
    expect(opusPacketSamples(new Uint8Array(0))).toBe(0);
  });
});

describe("l'Opus en MP4 fragmenté (opusMp4.ts)", () => {
  const index = parseOpusHead(OPUS_WEBM, OPUS_WEBM.length);
  if (!index) throw new Error("index");

  it("écrit un segment d'initialisation : une piste Opus à 48 kHz et son dOps", () => {
    const init = opusInitSegment(index.head);
    expect(boxes(init).map(([type]) => type)).toEqual(["ftyp", "moov"]);
    const [entryStart] = find(init, ["moov", "trak", "mdia", "minf", "stbl", "stsd"]);
    expect(Buffer.from(init.subarray(entryStart + 4, entryStart + 8)).toString("latin1")).toBe("Opus");
    const view = new DataView(init.buffer, init.byteOffset, init.length);
    // Entrée audio : 8 d'en-tête, 6 réservés, 2 d'index, 8 réservés, puis canaux, taille, 4 réservés, fréquence 16.16.
    expect(view.getUint16(entryStart + 24)).toBe(2);
    expect(view.getUint32(entryStart + 32)).toBe(48_000 * 65536);
    const dops = entryStart + 36;
    expect(Buffer.from(init.subarray(dops + 4, dops + 8)).toString("latin1")).toBe("dOps");
    expect(init[dops + 8]).toBe(0);                // version
    expect(init[dops + 9]).toBe(2);                // canaux
    // Le pré-saut d'OpusHead (petit-boutiste) recopié en gros-boutiste.
    expect(view.getUint16(dops + 10)).toBe(new DataView(index.head.buffer, index.head.byteOffset).getUint16(10, true));
    expect(view.getUint32(dops + 12)).toBe(48_000);
  });

  it("écrit un fragment : un échantillon par paquet, daté du premier, les octets recopiés", () => {
    const range = opusSegmentRange(index, 1);
    const packets = clusterPackets(OPUS_WEBM.subarray(range?.start, (range?.end ?? 0) + 1), index) ?? [];
    const fragment = opusFragment(packets, 2);
    if (!fragment) throw new Error("fragment");
    const top = boxes(fragment);
    expect(top.map(([type]) => type)).toEqual(["moof", "mdat"]);
    const view = new DataView(fragment.buffer, fragment.byteOffset, fragment.length);
    const [tfdt] = find(fragment, ["moof", "traf", "tfdt"]);
    expect(Number(view.getBigUint64(tfdt + 4))).toBe(packets[0].time);
    const [trun] = find(fragment, ["moof", "traf", "trun"]);
    expect(view.getUint32(trun + 4)).toBe(packets.length);
    // Le décalage des données : le premier octet après l'en-tête du mdat, compté depuis le moof.
    expect(view.getUint32(trun + 8)).toBe(top[1][1] + 8);
    expect(view.getUint32(trun + 12)).toBe(960);                 // durée du premier échantillon
    expect(view.getUint32(trun + 16)).toBe(packets[0].data.length);
    const payload = packets.reduce((sum, packet) => sum + packet.data.length, 0);
    expect(top[1][2]).toBe(8 + payload);
    expect([...fragment.subarray(top[1][1] + 8, top[1][1] + 8 + packets[0].data.length)]).toEqual([...packets[0].data]);
    expect(opusFragment([], 1)).toBeNull();
  });

  it("écrit la liste HLS : un segment par grappe, leurs durées, le segment d'initialisation", () => {
    const text = opusPlaylist(index, (i) => `s/${i}.ts?t=x`, "s/init.mp4?t=x");
    expect(text).toContain('#EXT-X-MAP:URI="s/init.mp4?t=x"');
    expect(text).toContain("#EXT-X-TARGETDURATION:1");
    expect(text.match(/#EXTINF:/g)?.length).toBe(3);
    expect(text).toContain("#EXTINF:0.981,\ns/0.ts?t=x");
    // La dernière va jusqu'à la durée du fichier.
    expect(text).toContain("#EXTINF:0.427,\ns/2.ts?t=x");
    expect(text.trimEnd().endsWith("#EXT-X-ENDLIST")).toBe(true);
  });
});
