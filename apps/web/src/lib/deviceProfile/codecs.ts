// ── Codec support detection ──
// MediaSource.isTypeSupported → MSE capability (hls.js / TranscodingProfiles)
// canPlayType → native <video> capability (DirectPlayProfiles)

const testVideo = typeof document !== "undefined" ? document.createElement("video") : null;

// Il y avait ici un `IS_NATIVE_HLS` fondé sur
// `canPlayType("application/vnd.apple.mpegurl")`, censé ne reconnaître que
// Safari. Chromium y répond « maybe » — mesuré dans la coquille Electron — et
// le drapeau retirait alors le seul profil de transcodage HEVC à des moteurs
// qui en avaient besoin : une piste audio non décodable, un simple AC3, faisait
// ré-encoder toute l'image. Le profil fMP4 conclut les deux chemins de lecture
// à la fois (cf. `profilHlsFmp4`), la distinction n'a donc plus lieu d'être.

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

/**
 * Moteur Chromium — la seule marque qu'on ait besoin de reconnaître ici.
 *
 * Le MKV ne se détecte pas : `canPlayType("video/x-matroska")` répond vide
 * partout, y compris là où la lecture fonctionne. Mais WebM *est* du Matroska,
 * donc un moteur qui lit du WebM/VP9 embarque forcément un démuxeur Matroska.
 * D'où le couple : la marque écarte Firefox et Safari, dont le démuxeur WebM
 * refuse les pistes non-WebM ; la capacité prouve que le démuxeur est là.
 *
 * Edge annonce `Chrome/` dans son UA et passe donc ce test — c'est voulu
 * (jellyfin-web #5611 : `browser.edg` y est indéfini, Edge se fait traiter
 * comme Chrome, et ses capacités réelles sont bien celles de Chrome).
 *
 * Même expression que `supportsBackdropSvgFilter` (packages/ui/src/glass/
 * engine.ts), recopiée à dessein plutôt qu'importée : ce paquet-là parle de
 * compositing, celui-ci de démuxage, et les deux n'ont aucune raison d'évoluer
 * ensemble.
 */
export function estChromium(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!/Chrom(e|ium)\//.test(navigator.userAgent)) return false;
  return canPlayVp9();
}
