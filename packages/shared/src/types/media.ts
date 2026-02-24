export interface MediaItem {
  Id: string;
  Name: string;
  Type: "Movie" | "Series" | "Episode" | "Audio" | "MusicAlbum";
  Overview?: string;
  ProductionYear?: number;
  CommunityRating?: number;
  OfficialRating?: string;
  RunTimeTicks?: number;
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  SeriesName?: string;
  SeriesId?: string;
  SeasonId?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  MediaSources?: MediaSource[];
  UserData?: UserItemData;
}

export interface MediaSource {
  Id: string;
  Name: string;
  Path?: string;
  Container: string;
  Size?: number;
  Bitrate?: number;
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
  Index: number;
}

export interface UserItemData {
  PlaybackPositionTicks: number;
  PlayCount: number;
  IsFavorite: boolean;
  Played: boolean;
  PlayedPercentage?: number;
}

export interface LibraryView {
  Id: string;
  Name: string;
  CollectionType: "movies" | "tvshows" | "music" | "mixed";
  ImageTags?: Record<string, string>;
}
