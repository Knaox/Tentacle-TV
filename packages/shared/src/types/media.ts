export interface MediaItem {
  Id: string;
  Name: string;
  Type: "Movie" | "Series" | "Episode" | "Season" | "BoxSet" | "Audio" | "MusicAlbum";
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

  // External IDs
  ProviderIds?: Record<string, string>;

  // Folder
  IsFolder?: boolean;
  ChildCount?: number;
  CollectionType?: string;

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
}

export interface MediaStream {
  Type: "Video" | "Audio" | "Subtitle";
  Codec: string;
  Language?: string;
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

export interface LibraryView {
  Id: string;
  Name: string;
  CollectionType?: string;
  ImageTags?: Record<string, string>;
}
