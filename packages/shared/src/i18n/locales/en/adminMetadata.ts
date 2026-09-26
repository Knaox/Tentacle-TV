/**
 * Admin → Metadata: the TMDB key, the recommendation run and the streaming
 * region. The rail label (`admin:metadataTitle`) and the "missing key" banner
 * (`admin:tmdbKey*`) stay in `admin`.
 */
export default {
  title: "Metadata",
  description:
    "What enriches Tentacle beyond Jellyfin: TMDB for recommendations, and the country whose streaming platforms are shown.",
  loadError: "Couldn't read the metadata settings.",
  loadErrorHint: "The Tentacle server didn't answer. Check the connection, then try again.",
  retry: "Try again",
} as const;
