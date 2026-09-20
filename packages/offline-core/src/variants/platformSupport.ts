/**
 * Ce que chaque MOTEUR de chaque plateforme mobile lit tel quel, sans que
 * personne ne transcode.
 *
 * Deux moteurs par plateforme : le lecteur natif (AVPlayer sur iOS, ExoPlayer
 * sur Android) et le lecteur avancé (libmpv). Source UNIQUE : les profils
 * d'appareil du mobile (`iosDeviceProfile.ts`, `androidDeviceProfile.ts`)
 * dérivent leurs chaînes DirectPlay de ces ensembles, le routeur de moteur
 * (`engineRouter.ts`) les consulte pour choisir qui lit, et la décision des
 * variantes hors ligne (`offlineVariants.ts`) lit ce que l'appareil sait lire.
 * Ce qui se lit en ligne en lecture directe et ce qui est proposé hors ligne
 * ne peuvent donc pas diverger.
 */

export interface PlatformMediaSupport {
  readonly containers: ReadonlySet<string>;
  readonly videoCodecs: ReadonlySet<string>;
  readonly audioCodecs: ReadonlySet<string>;
  /** Codecs de sous-titres que le moteur rend lui-même (noms Jellyfin). */
  readonly subtitleCodecs: ReadonlySet<string>;
  /** Le lecteur désentrelace-t-il un flux entrelacé ? AVPlayer, non. */
  readonly deinterlaces: boolean;
}

/** Les sous-titres texte que l'overlay du lecteur natif dessine. */
const TEXT_SUBTITLES = ["subrip", "srt", "vtt", "webvtt", "mov_text", "text"];

/** Tout ce que libass et mpv rendent : les textes, stylés ou non, et les images. */
const MPV_SUBTITLES = [...TEXT_SUBTITLES, "ass", "ssa", "pgssub", "pgs", "dvdsub", "vobsub", "dvbsub"];

/** Les conteneurs, codecs vidéo et audio que libmpv démuxe et décode sur mobile. */
const MPV_CONTAINERS = [
  "mkv", "webm", "mp4", "m4v", "mov", "avi", "ts", "mpegts", "m2ts", "flv",
  "ogg", "ogv", "wmv", "asf", "3gp", "mpg", "mpeg", "vob",
];
const MPV_VIDEO_CODECS = [
  "h264", "hevc", "av1", "vp9", "vp8", "mpeg2video", "mpeg4", "msmpeg4v3",
  "vc1", "wmv3", "wmv2", "theora", "mjpeg", "prores",
];
const MPV_AUDIO_CODECS = [
  "aac", "ac3", "eac3", "dts", "truehd", "mlp", "flac", "alac", "opus", "vorbis",
  "mp3", "mp2", "mp1", "pcm_s16le", "pcm_s24le", "pcm_s32le", "pcm_f32le",
  "pcm_mulaw", "pcm_alaw", "wmav2", "wmapro",
];

/**
 * iOS / AVPlayer : MP4, MOV, H.264, HEVC ; ni MKV, ni DTS, ni TrueHD. L'ordre
 * des ensembles est celui des chaînes DirectPlay historiques, conservé pour
 * que le profil envoyé à Jellyfin ne change pas d'un octet. Les sous-titres
 * ASS n'y sont pas : l'overlay les aplatirait, le lecteur avancé les rend.
 */
export const IOS_NATIVE_SUPPORT: PlatformMediaSupport = {
  containers: new Set(["mp4", "m4v", "mov"]),
  videoCodecs: new Set(["h264", "hevc"]),
  audioCodecs: new Set(["aac", "flac", "alac", "ac3", "eac3", "mp3"]),
  subtitleCodecs: new Set(TEXT_SUBTITLES),
  deinterlaces: false,
};

/** iOS / libmpv : tout le reste, décodage logiciel compris (léger pour les codecs anciens). */
export const IOS_MPV_SUPPORT: PlatformMediaSupport = {
  containers: new Set(MPV_CONTAINERS),
  videoCodecs: new Set(MPV_VIDEO_CODECS),
  audioCodecs: new Set(MPV_AUDIO_CODECS),
  subtitleCodecs: new Set(MPV_SUBTITLES),
  deinterlaces: true,
};

/**
 * Android / ExoPlayer : MKV, WebM et TS en plus ; l'extension FFmpeg de
 * Jellyfin (Media3 1.9, préférée à MediaCodec) décode DTS, TrueHD, MLP, ALAC
 * et PCM là où l'appareil n'a rien — et remplace le décodeur E-AC-3 défaillant
 * des Pixel 6-8. Les PGS sont rendus. L'ASS l'est aussi, mais appauvri (ni
 * positions ni polices) : le routeur l'envoie au lecteur avancé quand le
 * réglage le demande. Les jetons historiques restent en tête, dans l'ordre.
 */
export const ANDROID_NATIVE_SUPPORT: PlatformMediaSupport = {
  containers: new Set(["mp4", "m4v", "mkv", "webm", "ts", "mpegts"]),
  videoCodecs: new Set(["h264", "hevc", "vp9"]),
  audioCodecs: new Set([
    "aac", "mp3", "flac", "opus", "vorbis", "ac3", "eac3",
    "dts", "truehd", "mlp", "alac", "pcm_s16le", "pcm_s24le", "pcm_mulaw", "pcm_alaw", "mp2",
  ]),
  subtitleCodecs: new Set([...TEXT_SUBTITLES, "ass", "ssa", "pgssub"]),
  deinterlaces: true,
};

/** Android / libmpv : mêmes capacités qu'iOS (le HDR y est tone-mappé, affaire du routeur). */
export const ANDROID_MPV_SUPPORT: PlatformMediaSupport = IOS_MPV_SUPPORT;

/** Ce que deux moteurs savent lire à eux deux. */
export function unionSupport(a: PlatformMediaSupport, b: PlatformMediaSupport): PlatformMediaSupport {
  return {
    containers: new Set([...a.containers, ...b.containers]),
    videoCodecs: new Set([...a.videoCodecs, ...b.videoCodecs]),
    audioCodecs: new Set([...a.audioCodecs, ...b.audioCodecs]),
    subtitleCodecs: new Set([...a.subtitleCodecs, ...b.subtitleCodecs]),
    deinterlaces: a.deinterlaces || b.deinterlaces,
  };
}

/**
 * Hors ligne : ce que l'appareil sait lire à lui seul, ses deux moteurs
 * réunis — le lecteur local passe par la même façade que le flux serveur, et
 * personne ne transcode un fichier déjà sur l'appareil. Le natif vient en
 * premier : ses jetons gardent la tête des listes.
 */
export const IOS_LOCAL_SUPPORT: PlatformMediaSupport = unionSupport(IOS_NATIVE_SUPPORT, IOS_MPV_SUPPORT);
export const ANDROID_LOCAL_SUPPORT: PlatformMediaSupport = unionSupport(ANDROID_NATIVE_SUPPORT, ANDROID_MPV_SUPPORT);

/** La forme attendue par un `DirectPlayProfile` Jellyfin : « a,b,c ». */
export function supportList(values: ReadonlySet<string>): string {
  return [...values].join(",");
}

/**
 * Un conteneur Jellyfin peut être une liste (« mov,mp4,m4a,3gp ») : il est
 * lu si UN de ses jetons est connu. `undefined` et la chaîne vide : non.
 */
export function supportsToken(values: ReadonlySet<string>, value: string | undefined): boolean {
  if (!value) return false;
  return value
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .some((token) => token.length > 0 && values.has(token));
}
