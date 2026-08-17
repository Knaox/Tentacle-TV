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
  /^Users\/[^/]+\/Images\/Primary$/,
  /^Users\/[^/]+\/Items/,
  // Resynchro de la progression hors ligne (style moderne 10.9+, pérenne 12.0)
  /^UserItems\/[^/]+\/UserData$/,
  /^Users\/[^/]+\/FavoriteItems\/[^/]+$/,
  /^Users\/[^/]+\/PlayedItems\/[^/]+$/,
  /^Users\/[^/]+\/Views$/,
  /^Users\/Me$/,
  /^Users\/AuthenticateByName$/,

  // Shows
  /^Shows\/NextUp$/,
  /^Shows\/[^/]+\/(Seasons|Episodes|NextUp)$/,

  // Playback reporting. NB : Sessions/Logout n'est PLUS proxyfiable — le token
  // Jellyfin d'un appareil jumelé est souvent PARTAGÉ (copié à l'appairage,
  // regreffé par le self-healing) : un client qui l'appellerait révoquerait le
  // token du web et de toutes les TVs sœurs d'un coup. Le seul logout Jellyfin
  // légitime est celui du backend lui-même (routes/auth.ts, token non partagé).
  /^Sessions\/Playing(\/Progress|\/Stopped)?$/,

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
