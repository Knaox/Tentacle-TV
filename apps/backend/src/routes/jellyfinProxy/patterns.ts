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
  // « Fait partie de » : les collections d'un titre (Jellyfin 12.0+).
  /^Items\/[^/]+\/Collections$/,

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

  // Mesure de débit : les clients TV chronomètrent un téléchargement témoin
  // pour réduire d'eux-mêmes la qualité quand la connexion ne suit pas. En dev
  // TOUT passe par le proxy — sans cette entrée, la mesure échoue (403) et le
  // cap automatique reste inerte (dégradation gracieuse voulue sur vieux serveur).
  /^Playback\/BitrateTest$/,

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

/** Décodages successifs au plus : au-delà, le chemin est tenu pour piégé. */
const MAX_DECODE_ROUNDS = 4;

/**
 * Le chemin remonte-t-il (ou se déguise-t-il) ? Plusieurs motifs de la liste
 * ne valent que par leur PRÉFIXE (`Items/{id}/Images/…`) : sans ce contrôle,
 * `Items/x/Images/../../../System/Configuration` passait la liste, et l'URL
 * relayée, résolue par undici, atteignait `/System/Configuration` — avec la
 * clé d'administration prêtée à un appareil jumelé. Décodé jusqu'au point fixe
 * (`%2e%2e`, `%252e%252e`, `%2f`), puis refusé dès qu'un segment vaut `.` ou
 * `..`, ou qu'une barre oblique inverse paraît (l'URL la lit comme `/`).
 * Aucune route de Jellyfin n'a de tels segments.
 */
export function hasUnsafePathSegment(path: string): boolean {
  let decoded = path;
  for (let round = 0; ; round += 1) {
    if (decoded.includes("\\")) return true;
    if (decoded.split("/").some((segment) => segment === "." || segment === "..")) return true;
    if (!decoded.includes("%")) return false;
    if (round >= MAX_DECODE_ROUNDS) return true;
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      // Un « % » orphelin : l'URL relayée le garde tel quel, sans point à résoudre —
      // mais un `%2e` voisin compterait encore. On le refuse plutôt que d'en juger.
      return /%2e/i.test(decoded);
    }
    if (next === decoded) return false;
    decoded = next;
  }
}

export function isAllowedProxyPath(path: string): boolean {
  if (hasUnsafePathSegment(path)) return false;
  return ALLOWED_PROXY_PATTERNS_CI.some((pattern) => pattern.test(path));
}
