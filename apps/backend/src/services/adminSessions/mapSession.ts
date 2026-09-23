import type {
  AdminNowPlayingDto,
  AdminPlayMethod,
  AdminSessionDto,
  AdminSourceDto,
  AdminTranscodingDto,
} from "./dto";

/**
 * Une session Jellyfin brute (`SessionInfoDto`, 10.11) réduite à ce que le
 * tableau de bord affiche. Fonction pure : elle se teste sans Jellyfin.
 */

/** Ce qu'on lit d'une session Jellyfin — tout est optionnel, rien n'est garanti. */
export interface RawSession {
  Id?: string;
  UserId?: string;
  UserName?: string;
  UserPrimaryImageTag?: string;
  Client?: string;
  DeviceName?: string;
  DeviceId?: string;
  ApplicationVersion?: string;
  RemoteEndPoint?: string;
  LastActivityDate?: string;
  LastPlaybackCheckIn?: string;
  SupportsRemoteControl?: boolean;
  NowPlayingItem?: RawItem | null;
  PlayState?: {
    PositionTicks?: number;
    IsPaused?: boolean;
    IsMuted?: boolean;
    AudioStreamIndex?: number;
    SubtitleStreamIndex?: number;
    PlayMethod?: string;
  } | null;
  TranscodingInfo?: RawTranscoding | null;
}

interface RawItem {
  Id?: string;
  Name?: string;
  Type?: string;
  SeriesName?: string;
  SeriesId?: string;
  SeriesPrimaryImageTag?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  ProductionYear?: number;
  RunTimeTicks?: number;
  ImageTags?: Record<string, string>;
  MediaStreams?: RawStream[];
}

interface RawStream {
  Type?: string;
  Index?: number;
  Codec?: string;
  Width?: number;
  Height?: number;
  VideoRangeType?: string;
  Channels?: number;
  Language?: string;
  DisplayTitle?: string;
  BitRate?: number;
}

interface RawTranscoding {
  VideoCodec?: string;
  AudioCodec?: string;
  Container?: string;
  IsVideoDirect?: boolean;
  IsAudioDirect?: boolean;
  Bitrate?: number;
  Framerate?: number;
  Width?: number;
  Height?: number;
  AudioChannels?: number;
  CompletionPercentage?: number;
  HardwareAccelerationType?: string;
  TranscodeReasons?: string[] | string;
}

const PLAY_METHODS: ReadonlySet<string> = new Set<AdminPlayMethod>(["DirectPlay", "DirectStream", "Transcode"]);

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function nowPlaying(item: RawItem): AdminNowPlayingDto | null {
  const itemId = str(item.Id);
  if (itemId === undefined) return null;
  const ownImage = str(item.ImageTags?.Primary);
  // Un épisode sans vignette propre prend l'affiche de sa série.
  const seriesImage = ownImage === undefined && str(item.SeriesId) !== undefined ? str(item.SeriesPrimaryImageTag) : undefined;
  return {
    itemId,
    name: str(item.Name) ?? "",
    type: str(item.Type) ?? "",
    seriesName: str(item.SeriesName),
    seasonNumber: num(item.ParentIndexNumber),
    episodeNumber: num(item.IndexNumber),
    productionYear: num(item.ProductionYear),
    runTimeTicks: num(item.RunTimeTicks),
    imageItemId: seriesImage !== undefined ? (item.SeriesId as string) : itemId,
    imageTag: ownImage ?? seriesImage,
  };
}

function source(item: RawItem, audioIndex: number | undefined, subtitleIndex: number | undefined): AdminSourceDto | null {
  const streams = Array.isArray(item.MediaStreams) ? item.MediaStreams : [];
  if (streams.length === 0) return null;
  const video = streams.find((s) => s.Type === "Video");
  const audio = streams.find((s) => s.Type === "Audio" && s.Index === audioIndex) ?? streams.find((s) => s.Type === "Audio");
  const subtitle = subtitleIndex !== undefined && subtitleIndex >= 0
    ? streams.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex)
    : undefined;
  return {
    videoCodec: str(video?.Codec),
    width: num(video?.Width),
    height: num(video?.Height),
    videoRange: str(video?.VideoRangeType),
    audioCodec: str(audio?.Codec),
    audioChannels: num(audio?.Channels),
    audioLanguage: str(audio?.Language),
    subtitle: str(subtitle?.DisplayTitle),
    bitrate: num(video?.BitRate),
  };
}

function transcoding(raw: RawTranscoding): AdminTranscodingDto {
  const reasons = Array.isArray(raw.TranscodeReasons)
    ? raw.TranscodeReasons.filter((r): r is string => typeof r === "string")
    : typeof raw.TranscodeReasons === "string" && raw.TranscodeReasons !== ""
      ? raw.TranscodeReasons.split(",").map((r) => r.trim())
      : [];
  return {
    videoCodec: str(raw.VideoCodec),
    audioCodec: str(raw.AudioCodec),
    container: str(raw.Container),
    isVideoDirect: raw.IsVideoDirect === true,
    isAudioDirect: raw.IsAudioDirect === true,
    bitrate: num(raw.Bitrate),
    framerate: num(raw.Framerate),
    width: num(raw.Width),
    height: num(raw.Height),
    audioChannels: num(raw.AudioChannels),
    completionPercentage: num(raw.CompletionPercentage),
    hardwareAccelerationType: str(raw.HardwareAccelerationType),
    reasons,
  };
}

/**
 * La session pour le tableau de bord, ou `null` si elle n'a rien à y faire :
 * sans utilisateur (clé d'API, tâche de fond), ou sans identifiant.
 */
export function toAdminSession(raw: RawSession, receivedAt: number): AdminSessionDto | null {
  const id = str(raw.Id);
  const userId = str(raw.UserId);
  if (id === undefined || userId === undefined) return null;
  const item = raw.NowPlayingItem ? nowPlaying(raw.NowPlayingItem) : null;
  const play = raw.PlayState ?? {};
  const method = str(play.PlayMethod);
  const checkIn = raw.LastPlaybackCheckIn ? Date.parse(raw.LastPlaybackCheckIn) : NaN;
  return {
    id,
    userId,
    userName: str(raw.UserName) ?? "",
    userImageTag: str(raw.UserPrimaryImageTag) ?? null,
    client: str(raw.Client) ?? "",
    deviceName: str(raw.DeviceName) ?? "",
    deviceId: str(raw.DeviceId) ?? "",
    applicationVersion: str(raw.ApplicationVersion) ?? "",
    remoteAddress: str(raw.RemoteEndPoint) ?? null,
    lastActivity: str(raw.LastActivityDate) ?? new Date(receivedAt).toISOString(),
    supportsRemoteControl: raw.SupportsRemoteControl === true,
    viaTentacle: false,
    nowPlaying: item,
    isPaused: play.IsPaused === true,
    isMuted: play.IsMuted === true,
    positionTicks: num(play.PositionTicks) ?? 0,
    // La position de Jellyfin date de son dernier report : c'est de là qu'on extrapole.
    positionAt: Number.isFinite(checkIn) ? checkIn : receivedAt,
    playMethod: item && method !== undefined && PLAY_METHODS.has(method) ? (method as AdminPlayMethod) : null,
    source: item && raw.NowPlayingItem ? source(raw.NowPlayingItem, num(play.AudioStreamIndex), num(play.SubtitleStreamIndex)) : null,
    transcoding: item && raw.TranscodingInfo ? transcoding(raw.TranscodingInfo) : null,
    watchGroupId: null,
  };
}
