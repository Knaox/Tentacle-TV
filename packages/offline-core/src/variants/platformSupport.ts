/**
 * Ce que le lecteur NATIF de chaque plateforme mobile lit tel quel, sans que
 * personne ne transcode — la seule chose qui compte hors ligne.
 *
 * Source UNIQUE : les profils d'appareil du mobile (`iosDeviceProfile.ts`,
 * `androidDeviceProfile.ts`) dérivent leurs chaînes DirectPlay de ces mêmes
 * ensembles, et la décision des variantes (`offlineVariants.ts`) les lit. Ce
 * qui se lit en ligne en lecture directe et ce qui est proposé hors ligne ne
 * peuvent donc plus diverger.
 */

export interface PlatformMediaSupport {
  readonly containers: ReadonlySet<string>;
  readonly videoCodecs: ReadonlySet<string>;
  readonly audioCodecs: ReadonlySet<string>;
  /** Le lecteur désentrelace-t-il un flux entrelacé ? AVPlayer, non. */
  readonly deinterlaces: boolean;
}

/**
 * iOS / AVPlayer : MP4, MOV, H.264, HEVC ; ni MKV, ni DTS, ni TrueHD. L'ordre
 * des ensembles est celui des chaînes DirectPlay historiques, conservé pour
 * que le profil envoyé à Jellyfin ne change pas d'un octet.
 */
export const IOS_LOCAL_SUPPORT: PlatformMediaSupport = {
  containers: new Set(["mp4", "m4v", "mov"]),
  videoCodecs: new Set(["h264", "hevc"]),
  audioCodecs: new Set(["aac", "flac", "alac", "ac3", "eac3", "mp3"]),
  deinterlaces: false,
};

/** Android / ExoPlayer : MKV et WebM en plus ; les décodeurs audio Dolby varient selon l'appareil. */
export const ANDROID_LOCAL_SUPPORT: PlatformMediaSupport = {
  containers: new Set(["mp4", "m4v", "mkv", "webm"]),
  videoCodecs: new Set(["h264", "hevc", "vp9"]),
  audioCodecs: new Set(["aac", "mp3", "flac", "opus", "vorbis", "ac3", "eac3"]),
  deinterlaces: true,
};

/** La forme attendue par un `DirectPlayProfile` Jellyfin : « a,b,c ». */
export function supportList(values: ReadonlySet<string>): string {
  return [...values].join(",");
}
