/**
 * Les noms de codec de ffmpeg (ceux que mpv rend) → les noms du contrat
 * (`MusicAudioFormat.codec` : « flac », « alac », « wav », « dsd »…), et le
 * format réellement décodé pour la barre de lecture. Pur.
 */

import type { AudioBridgeCapabilities, AudioBridgeFormat } from "./audioBridgeContract";

const LOSSLESS: ReadonlySet<string> = new Set(["flac", "alac", "wav", "aiff", "pcm", "dsd", "ape", "wavpack", "truehd", "tta"]);

/** Le nom du contrat d'un décodeur ffmpeg ; `null` s'il ne nous concerne pas. */
export function contractCodec(decoder: string, container: string | null = null): string | null {
  const d = decoder.toLowerCase();
  if (d.startsWith("dsd_")) return "dsd";
  if (d.startsWith("pcm_")) {
    if (container !== null && /aiff/i.test(container)) return "aiff";
    if (container !== null && /wav/i.test(container)) return "wav";
    return container === null ? "wav" : "pcm";
  }
  if (d === "mp3float" || d === "mp3" || d === "mp3adu") return "mp3";
  if (d === "libopus" || d === "opus") return "opus";
  if (d === "aac" || d === "aac_fixed" || d === "aac_at" || d === "aac_latm") return "aac";
  if (d === "libvorbis" || d === "vorbis") return "vorbis";
  if (["flac", "alac", "ape", "wavpack", "truehd", "tta"].includes(d)) return d;
  return null;
}

/** Les codecs du contrat que la libmpv chargée sait décoder (`decoder-list`). */
export function codecsFromDecoderList(json: string | null): string[] {
  let raw: unknown;
  try {
    raw = json === null ? [] : JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const found = new Set<string>();
  for (const d of raw) {
    if (typeof d !== "object" || d === null) continue;
    const codec = (d as Record<string, unknown>)["codec"];
    if (typeof codec !== "string") continue;
    const name = contractCodec(codec);
    if (name !== null && name !== "pcm") found.add(name);
  }
  return [...found].sort();
}

export interface DecodedProps {
  codecName: string | null;
  fileFormat: string | null;
  sampleRate: number | null;
  channels: number | null;
  bitrate: number | null;
}

/**
 * Le format affiché : ce que mpv DÉCODE (codec, fréquence, canaux, débit), et
 * la profondeur de bits ANNONCÉE par la bibliothèque — le décodeur rend du
 * s32 ou du flottant quelle que soit la profondeur du fichier.
 */
export function decodedFormat(props: DecodedProps, announced: AudioBridgeFormat | null): AudioBridgeFormat | null {
  const codec = props.codecName === null ? null : contractCodec(props.codecName, props.fileFormat);
  if (codec === null) return announced;
  const sameCodec = announced !== null && announced.codec === codec;
  return {
    codec,
    container: props.fileFormat ?? announced?.container ?? null,
    sampleRate: props.sampleRate ?? announced?.sampleRate ?? null,
    bitDepth: sameCodec ? announced.bitDepth : null,
    bitrate: props.bitrate !== null && props.bitrate > 0 ? Math.round(props.bitrate) : announced?.bitrate ?? null,
    channels: props.channels ?? announced?.channels ?? null,
    lossless: LOSSLESS.has(codec),
  };
}

/**
 * Ce que le moteur natif sait faire. Le gapless, la bascule à chaud et la
 * sortie exclusive sont MESURÉS au banc (`bench/audio/`) — macOS ; WASAPI et
 * PipeWire suivent le même code, non vérifiés sur machine.
 */
export function mpvCapabilities(codecs: string[]): AudioBridgeCapabilities {
  return { engine: "mpv", gapless: true, exclusiveOutput: true, replayGain: true, codecs, hotSwap: true };
}
