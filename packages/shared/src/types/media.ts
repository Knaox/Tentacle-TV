export interface MediaItem {
  Id: string;
  Name: string;
  Type: "Movie" | "Series" | "Episode" | "Season" | "BoxSet" | "Audio" | "MusicAlbum";
  OriginalTitle?: string;
  Overview?: string;
  Taglines?: string[];
  Genres?: string[];
  ProductionYear?: number;
  PremiereDate?: string;
  DateCreated?: string;
  CommunityRating?: number;
  CriticRating?: number;
  OfficialRating?: string;
  RunTimeTicks?: number;
  Container?: string;
  MediaType?: string;

  // Images
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  ParentBackdropImageTags?: string[];
  ParentBackdropItemId?: string;
  SeriesPrimaryImageTag?: string;
  PrimaryImageAspectRatio?: number;

  // Parent / hierarchy
  ParentId?: string;

  // Series / Episode
  SeriesName?: string;
  SeriesId?: string;
  SeasonId?: string;
  SeasonName?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  Status?: string;

  // Media
  MediaSources?: MediaSource[];
  UserData?: UserItemData;
  Chapters?: ChapterInfo[];

  // Tags
  Tags?: string[];

  // External URLs
  ExternalUrls?: Array<{ Name: string; Url: string }>;

  // External IDs
  ProviderIds?: Record<string, string>;

  // Folder
  IsFolder?: boolean;
  ChildCount?: number;
  CollectionType?: string;

  // Studios
  Studios?: Array<{ Name: string; Id: string }>;

  // People
  People?: Array<{
    Name: string;
    Id: string;
    Role?: string;
    Type: string;
    PrimaryImageTag?: string;
  }>;
}

export interface MediaSource {
  Id: string;
  Name: string;
  Path?: string;
  Container: string;
  Size?: number;
  Bitrate?: number;
  RunTimeTicks?: number;
  SupportsDirectPlay: boolean;
  SupportsDirectStream: boolean;
  SupportsTranscoding: boolean;
  MediaStreams: MediaStream[];
  // Fields returned by POST /Items/{id}/PlaybackInfo
  TranscodingUrl?: string;
  TranscodingSubProtocol?: string;
  TranscodingContainer?: string;
  DefaultAudioStreamIndex?: number;
  DefaultSubtitleStreamIndex?: number;
}

export interface PlaybackInfoResponse {
  MediaSources: MediaSource[];
  PlaySessionId: string;
}

export interface MediaStream {
  Type: "Video" | "Audio" | "Subtitle";
  Codec: string;
  Language?: string;
  Title?: string;
  DisplayTitle?: string;
  IsDefault: boolean;
  IsForced?: boolean;
  IsExternal?: boolean;
  Index: number;
  Width?: number;
  Height?: number;
  BitRate?: number;
  Channels?: number;
  SampleRate?: number;
  VideoRangeType?: string;
}

export interface UserItemData {
  PlaybackPositionTicks: number;
  PlayCount: number;
  IsFavorite: boolean;
  Played: boolean;
  PlayedPercentage?: number;
  UnplayedItemCount?: number;
  LastPlayedDate?: string;
}

export interface ChapterInfo {
  StartPositionTicks: number;
  Name: string;
}

export interface SegmentTimestamps {
  start: number;
  end: number;
}

export interface LibraryView {
  Id: string;
  Name: string;
  CollectionType?: string;
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  ChildCount?: number;
  RecursiveItemCount?: number;
}

// ── DeviceProfile types (Jellyfin PlaybackInfo API) ──

export interface DirectPlayProfile {
  Container: string;
  Type: "Video" | "Audio";
  VideoCodec?: string;
  AudioCodec?: string;
}

export interface TranscodingProfile {
  Container: string;
  Type: "Video" | "Audio";
  VideoCodec?: string;
  AudioCodec?: string;
  Protocol: string;
  EstimateContentLength?: boolean;
  EnableMpegtsM2TsMode?: boolean;
  TranscodeSeekInfo?: "Auto" | "Bytes";
  CopyTimestamps?: boolean;
  Context?: "Streaming" | "Static";
  MaxAudioChannels?: string;
  MinSegments?: number;
  SegmentLength?: number;
  BreakOnNonKeyFrames?: boolean;
}

export interface ProfileCondition {
  Condition: "Equals" | "NotEquals" | "LessThanEqual" | "GreaterThanEqual" | "EqualsAny";
  Property: string;
  Value: string;
  IsRequired?: boolean;
}

export interface CodecProfile {
  Type: "Video" | "VideoAudio" | "Audio";
  Codec?: string;
  Conditions: ProfileCondition[];
  ApplyConditions?: ProfileCondition[];
}

export interface SubtitleProfile {
  Format: string;
  Method: "Encode" | "Embed" | "External" | "Hls" | "Drop";
}

export interface ResponseProfile {
  Type: "Video" | "Audio";
  Container?: string;
  VideoCodec?: string;
  AudioCodec?: string;
  MimeType: string;
}

export interface DeviceProfile {
  MaxStreamingBitrate?: number;
  MaxStaticBitrate?: number;
  MusicStreamingTranscodingBitrate?: number;
  DirectPlayProfiles: DirectPlayProfile[];
  TranscodingProfiles: TranscodingProfile[];
  CodecProfiles?: CodecProfile[];
  SubtitleProfiles: SubtitleProfile[];
  ResponseProfiles?: ResponseProfile[];
}
