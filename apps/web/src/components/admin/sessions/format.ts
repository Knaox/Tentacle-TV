/**
 * Les petites mises en forme du tableau de bord des sessions : minutage,
 * débit, définition, codecs. Pures — la page ne fait que les appeler.
 */

const TICKS_PER_SECOND = 10_000_000;

/** `1:02:03` au-delà d'une heure, `2:03` en deçà. */
export function formatClock(ticks: number): string {
  const total = Math.max(0, Math.floor(ticks / TICKS_PER_SECOND));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

export function formatBitrate(bitsPerSecond: number | undefined, locale: string): string | null {
  if (!bitsPerSecond || bitsPerSecond <= 0) return null;
  const mbps = bitsPerSecond / 1_000_000;
  if (mbps < 1) return `${Math.round(bitsPerSecond / 1_000)} kb/s`;
  const digits = mbps >= 10 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(mbps)} Mb/s`;
}

export function resolutionLabel(width?: number, height?: number): string | null {
  if (!width || !height) return null;
  if (width >= 3800 || height >= 2100) return "4K";
  if (width >= 2500 || height >= 1400) return "1440p";
  if (width >= 1900 || height >= 1000) return "1080p";
  if (width >= 1200 || height >= 700) return "720p";
  return `${height}p`;
}

const CODECS: Record<string, string> = {
  h264: "H.264", avc: "H.264", hevc: "HEVC", h265: "HEVC", av1: "AV1", vp9: "VP9", vp8: "VP8",
  mpeg2video: "MPEG-2", mpeg4: "MPEG-4", vc1: "VC-1",
  aac: "AAC", ac3: "Dolby Digital", eac3: "Dolby Digital+", truehd: "TrueHD", dts: "DTS",
  flac: "FLAC", opus: "Opus", mp3: "MP3", vorbis: "Vorbis", pcm_s16le: "PCM", pcm_s24le: "PCM",
};

export function codecLabel(codec?: string): string | null {
  if (!codec) return null;
  return CODECS[codec.toLowerCase()] ?? codec.toUpperCase();
}

/** `SDR` ne mérite pas d'être dit ; le reste, si. */
export function rangeLabel(range?: string): string | null {
  if (!range || range === "SDR" || range === "Unknown") return null;
  if (range.startsWith("DOVI")) return "Dolby Vision";
  if (range === "HDR10Plus") return "HDR10+";
  return range;
}

export function channelsLabel(channels?: number): string | null {
  if (!channels) return null;
  const known: Record<number, string> = { 1: "1.0", 2: "2.0", 3: "2.1", 6: "5.1", 8: "7.1" };
  return known[channels] ?? `${channels} ch`;
}

const ACCELERATORS: Record<string, string> = {
  videotoolbox: "VideoToolbox", nvenc: "NVENC", qsv: "Quick Sync", vaapi: "VA-API",
  amf: "AMF", v4l2m2m: "V4L2", rkmpp: "RKMPP",
};

/** `null` : encodage logiciel (ou inconnu). */
export function acceleratorLabel(type?: string): string | null {
  if (!type || type.toLowerCase() === "none") return null;
  return ACCELERATORS[type.toLowerCase()] ?? type;
}

/** Repli d'une raison de transcodage sans traduction : `VideoCodecNotSupported` → `Video codec not supported`. */
export function humanizeReason(reason: string): string {
  const words = reason.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Une ligne « codec définition plage » pour la source ou la sortie — éléments absents sautés. */
export function joinParts(parts: ReadonlyArray<string | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === "string" && p !== "").join(" · ");
}

/** La position à l'instant `now` (ms, notre horloge), extrapolée et bornée à la durée. */
export function livePositionTicks(
  positionTicks: number,
  positionAt: number,
  isPaused: boolean,
  now: number,
  clockOffsetMs: number,
  runTimeTicks?: number,
): number {
  if (isPaused) return positionTicks;
  const elapsed = Math.max(0, now + clockOffsetMs - positionAt);
  const ticks = positionTicks + elapsed * (TICKS_PER_SECOND / 1000);
  return runTimeTicks ? Math.min(ticks, runTimeTicks) : ticks;
}
