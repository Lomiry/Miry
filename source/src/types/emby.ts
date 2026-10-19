export interface Account {
  server: string;
  userId: string;
  name: string;
  token: string;
  deviceId: string;
  remark?: string;
  homeServer?: string;
  serverId?: string;
}
export interface UserData {
  Played?: boolean;
  IsFavorite?: boolean;
  PlaybackPositionTicks?: number;
  PlayedPercentage?: number;
}
export interface Item {
  Id: string;
  Name: string;
  Type: string;
  OriginalTitle?: string;
  OriginalSeriesTitle?: string;
  ProviderIds?: Record<string, string>;
  SeriesProviderIds?: Record<string, string>;
  CollectionType?: string;
  IsMissing?: boolean;
  IsVirtual?: boolean;
  ProductionYear?: number;
  Overview?: string;
  RunTimeTicks?: number;
  CommunityRating?: number;
  Genres?: string[];
  IndexNumber?: number;
  ParentIndexNumber?: number;
  SeriesName?: string;
  SeriesId?: string;
  ParentId?: string;
  ParentPrimaryItemId?: string;
  ParentPrimaryImageTag?: string;
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  SeriesPrimaryImageTag?: string;
  SeriesThumbImageTag?: string;
  ParentThumbItemId?: string;
  ParentThumbImageTag?: string;
  ParentBackdropItemId?: string;
  ParentBackdropImageTags?: string[];
  UserData?: UserData;
  MediaSources?: MediaSource[];
  MediaStreams?: MediaStream[];
  People?: {
    Id: string;
    Name: string;
    Type?: string;
    Role?: string;
    PrimaryImageTag?: string;
    OriginalName?: string;
  }[];
  IntroStartPositionTicks?: number;
  IntroEndPositionTicks?: number;
  CreditsPositionTicks?: number;
  Chapters?: {
    Name?: string;
    StartPositionTicks: number;
    MarkerType?: string;
    ImageTag?: string;
    ChapterIndex?: number;
  }[];
}
export interface ItemPage {
  Items: Item[];
  TotalRecordCount: number;
}
export interface MediaStream {
  Type: string;
  Codec?: string;
  DisplayTitle?: string;
  Index: number;
  IsExternal?: boolean;
  DeliveryUrl?: string;
  Language?: string;
  Height?: number;
  Width?: number;
  BitDepth?: number;
  VideoRange?: string;
  ColorPrimaries?: string;
  ColorTransfer?: string;
  ColorSpace?: string;
  DvProfile?: number;
  DvLevel?: number;
  DvBlSignalCompatibilityId?: number;
  ExtendedVideoType?: string;
  ExtendedVideoSubType?: string;
}
export interface MediaSource {
  Id: string;
  Path?: string;
  Protocol?: string;
  IsRemote?: boolean;
  ETag?: string;
  Name?: string;
  Bitrate?: number;
  Container?: string;
  DirectStreamUrl?: string;
  TranscodingUrl?: string;
  SupportsTranscoding?: boolean;
  TranscodingContainer?: string;
  MediaStreams?: MediaStream[];
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  RequiresOpening?: boolean;
  RequiresClosing?: boolean;
  DefaultAudioStreamIndex?: number;
  DefaultSubtitleStreamIndex?: number;
  RunTimeTicks?: number;
}
export interface PlaybackInfo {
  MediaSources: MediaSource[];
  PlaySessionId: string;
  ErrorCode?: string;
}
