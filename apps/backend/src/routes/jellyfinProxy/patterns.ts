/** Whitelist of allowed Jellyfin proxy path patterns.
 *  Anything outside these patterns is rejected with 403 to prevent the proxy
 *  from being used as an open relay against the upstream Jellyfin server. */
const ALLOWED_PROXY_PATTERNS: RegExp[] = [
  // Streaming — Videos/{id}/... or Videos/{id}/{mediaSourceId}/...
  /^Videos\/[^/]+\/(stream|stream\.mp4|PlaybackInfo)/,
  /^Videos\/[^/]+\/[^/]+\/(master\.m3u8|main\.m3u8|Subtitles)/,
  /^Videos\/[^/]+\/(master\.m3u8|main\.m3u8|Subtitles)/,
  /^Audio\/[^/]+\//,
  /^(Videos\/[^/]+\/)?hls1\//,
  /^Videos\/ActiveEncodings$/,

  // Items & metadata
  /^Items(\/[^/]+)?(\/Images|\/Similar|\/Ancestors|\/PlaybackInfo)?$/,
  /^Items\/[^/]+\/Images\//,

  // User data
  /^Users\/[^/]+\/Items/,
  /^Users\/[^/]+\/FavoriteItems\/[^/]+$/,
  /^Users\/[^/]+\/PlayedItems\/[^/]+$/,
  /^Users\/[^/]+\/Views$/,
  /^Users\/Me$/,
  /^Users\/AuthenticateByName$/,

  // Shows
  /^Shows\/NextUp$/,
  /^Shows\/[^/]+\/(Seasons|Episodes|NextUp)$/,

  // Playback reporting
  /^Sessions\/Playing(\/Progress|\/Stopped)?$/,
  /^Sessions\/Logout$/,

  // Media analysis
  /^MediaSegments\/[^/]+$/,
  /^Episode\/[^/]+\/(IntroSkipperSegments|Timestamps)$/,

  // System
  /^System\/Info\/Public$/,
  /^Branding\/Configuration$/,

  // Search
  /^Search\/Hints$/,

  // Display preferences
  /^DisplayPreferences\//,

  // Filters
  /^(Genres|Studios|Persons|Artists)(\/|$)/,
];

const ALLOWED_PROXY_PATTERNS_CI = ALLOWED_PROXY_PATTERNS.map(
  (p) => new RegExp(p.source, "i"),
);

export function isAllowedProxyPath(path: string): boolean {
  return ALLOWED_PROXY_PATTERNS_CI.some((pattern) => pattern.test(path));
}
