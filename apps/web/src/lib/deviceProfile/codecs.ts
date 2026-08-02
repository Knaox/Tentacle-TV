// ── Codec support detection ──
// MediaSource.isTypeSupported → MSE capability (hls.js / TranscodingProfiles)
// canPlayType → native <video> capability (DirectPlayProfiles)

const testVideo = typeof document !== "undefined" ? document.createElement("video") : null;

/** Safari-only: native HLS support. False on Chrome/Brave/Firefox/Edge. */
export const IS_NATIVE_HLS = testVideo?.canPlayType("application/vnd.apple.mpegurl") !== "";

export function supportsVideoCodec(codec: string, container = "mp4"): boolean {
  if (typeof MediaSource !== "undefined" && MediaSource.isTypeSupported) {
    return MediaSource.isTypeSupported(`video/${container}; codecs="${codec}"`);
  }
  // Fallback for Safari iOS < 17.1 (no MSE)
  return testVideo?.canPlayType(`video/${container}; codecs="${codec}"`) !== "";
}

export function supportsAudioCodec(codec: string): boolean {
  if (typeof MediaSource !== "undefined" && MediaSource.isTypeSupported) {
    return MediaSource.isTypeSupported(`audio/mp4; codecs="${codec}"`);
  }
  return testVideo?.canPlayType(`audio/mp4; codecs="${codec}"`) !== "";
}

/** Check native container support via canPlayType (for DirectPlayProfiles). */
export function canPlayContainer(mime: string): boolean {
  return testVideo?.canPlayType(mime) !== "";
}

export const canPlayH264 = () => supportsVideoCodec("avc1.640029");
export const canPlayHevc = () => supportsVideoCodec("hev1.1.6.L150.B0") || supportsVideoCodec("hvc1.1.6.L150.B0");
export const canPlayVp9  = () => supportsVideoCodec("vp09.00.51.08", "webm") || supportsVideoCodec("vp09.00.51.08");
export const canPlayAv1  = () => supportsVideoCodec("av01.0.15M.10");
export const canPlayAac  = () => supportsAudioCodec("mp4a.40.2");
export const canPlayMp3  = () => supportsAudioCodec("mp4a.69") || supportsAudioCodec("mp4a.6B");
export const canPlayAc3  = () => supportsAudioCodec("ac-3");
export const canPlayEac3 = () => supportsAudioCodec("ec-3");
export const canPlayFlac = () => supportsAudioCodec("flac");
export const canPlayOpus = () => supportsAudioCodec("opus");
