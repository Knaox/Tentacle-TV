/**
 * Le catalogue des fonctionnalités éprouvées : ce que la suite contrôle, et
 * ce que le manifeste (`compat/jellyfin.json`) en dit à l'administration.
 * Un identifiant ne change JAMAIS — l'administration et les manifestes déjà
 * publiés s'y réfèrent. Les libellés, eux, se corrigent librement.
 *
 * `endpoints` : ce que le Jellyfin connecté doit publier dans son OpenAPI
 * (vérifié par la suite, et sondé à l'exécution par l'administration). Les
 * routes HLS n'y figurent jamais : la 12.1 les retire du document.
 * `since` : première version de Jellyfin qui offre la capacité — en dessous,
 * la fonctionnalité est sans objet et la suite ne la joue pas.
 */

import type { CompatFeature, LocalizedText } from "../../src/services/jellyfinCompat/compatManifest";

export const AREAS: Record<string, LocalizedText> = {
  auth: { fr: "Connexion", en: "Sign-in" },
  library: { fr: "Bibliothèque", en: "Library" },
  details: { fr: "Fiches", en: "Details" },
  userdata: { fr: "Suivi et listes", en: "Tracking and lists" },
  playback: { fr: "Lecture", en: "Playback" },
  direct: { fr: "Streaming direct", en: "Direct streaming" },
  media: { fr: "Images et vignettes", en: "Images and thumbnails" },
  segments: { fr: "Intro et génériques", en: "Intros and credits" },
  extras: { fr: "Bonus et bandes-annonces", en: "Extras and trailers" },
  sessions: { fr: "Sessions en direct", en: "Live sessions" },
  admin: { fr: "Administration", en: "Administration" },
  search: { fr: "Recherche", en: "Search" },
  jellyfin12: { fr: "Nouveautés de Jellyfin 12", en: "Jellyfin 12 features" },
};

const f = (
  id: string, area: string, critical: boolean, fr: string, en: string, endpoints: string[], since: string | null = null,
): CompatFeature => ({ id, area, critical, label: { fr, en }, endpoints, since });

export const FEATURES: CompatFeature[] = [
  f("auth.login", "auth", true, "Connexion d'un compte", "Account sign-in", ["POST /Users/AuthenticateByName", "GET /Users/Me"]),
  f("auth.modern", "auth", true, "Authentification moderne (en-tête MediaBrowser, ApiKey)", "Modern authentication (MediaBrowser header, ApiKey)", ["GET /System/Info"]),
  f("auth.installed-apps", "auth", true, "Applications déjà installées (anciens en-têtes)", "Already-installed apps (legacy headers)", ["GET /Users/Me"]),
  f("library.views", "library", true, "Bibliothèques films, séries et mixtes", "Movie, show and mixed libraries", ["GET /UserViews"]),
  f("library.catalog", "library", true, "Catalogue, tris et filtres", "Catalog, sorting and filters", ["GET /Items", "GET /Genres", "GET /Studios"]),
  f("library.home", "library", true, "Accueil : reprise, à suivre, nouveautés", "Home: resume, next up, recently added", ["GET /UserItems/Resume", "GET /Shows/NextUp", "GET /Items"]),
  f("details.item", "details", true, "Fiche d'un titre", "Title details", ["GET /Items/{itemId}", "GET /Items/{itemId}/Ancestors", "GET /Items/{itemId}/Similar"]),
  f("details.series", "details", true, "Saisons et épisodes", "Seasons and episodes", ["GET /Shows/{seriesId}/Seasons", "GET /Shows/{seriesId}/Episodes"]),
  f("userdata.lists", "userdata", false, "Ma liste, favoris et « vu »", "My list, favorites and watched", ["POST /UserFavoriteItems/{itemId}", "POST /UserPlayedItems/{itemId}", "POST /UserItems/{itemId}/Rating"]),
  f("userdata.resume", "userdata", true, "Reprise de lecture", "Resume position", ["POST /Sessions/Playing", "POST /Sessions/Playing/Progress", "POST /Sessions/Playing/Stopped", "GET /UserItems/{itemId}/UserData"]),
  f("userdata.paired-devices", "userdata", false, "Téléviseurs jumelés", "Paired TVs", ["POST /UserItems/{itemId}/UserData"]),
  f("playback.direct-play", "playback", true, "Lecture directe du fichier", "Direct play", ["POST /Items/{itemId}/PlaybackInfo", "GET /Videos/{itemId}/stream"]),
  f("playback.transcode", "playback", true, "Transcodage (HLS)", "Transcoding (HLS)", ["POST /Items/{itemId}/PlaybackInfo"]),
  f("playback.subtitles", "playback", false, "Sous-titres intégrés et externes", "Embedded and external subtitles", ["GET /Videos/{routeItemId}/{routeMediaSourceId}/Subtitles/{routeIndex}/Stream.{routeFormat}"]),
  f("playback.bitrate", "playback", false, "Mesure du débit", "Bandwidth test", ["GET /Playback/BitrateTest"]),
  f("direct.streaming", "direct", false, "Streaming direct vers Jellyfin", "Direct streaming to Jellyfin", ["POST /Items/{itemId}/PlaybackInfo", "GET /Videos/{itemId}/stream", "POST /Sessions/Playing"]),
  f("media.images", "media", true, "Affiches, fonds et avatars", "Posters, backdrops and avatars", ["GET /Items/{itemId}/Images/{imageType}", "GET /UserImage"]),
  f("media.trickplay", "media", false, "Vignettes de navigation (trickplay)", "Seek thumbnails (trickplay)", ["GET /Videos/{itemId}/Trickplay/{width}/{index}.jpg"]),
  f("segments.skip", "segments", false, "Passer l'intro et le générique", "Skip intro and credits", ["GET /MediaSegments/{itemId}"]),
  f("extras.trailers", "extras", false, "Bandes-annonces locales et bonus", "Local trailers and extras", ["GET /Items/{itemId}/LocalTrailers", "GET /Items/{itemId}/SpecialFeatures"]),
  f("sessions.live", "sessions", false, "Sessions en direct et télécommande", "Live sessions and remote control", ["GET /Sessions", "POST /Sessions/{sessionId}/Message"]),
  f("admin.server", "admin", false, "État du serveur, comptes et droits", "Server status, accounts and permissions", ["GET /System/Info", "GET /Users", "POST /Users/{userId}/Policy"]),
  f("search.catalog", "search", false, "Recherche Tentacle", "Tentacle search", ["GET /Items"]),
  f("jellyfin12.episode-versions", "jellyfin12", false, "Versions multiples d'un épisode", "Multiple versions of an episode", ["POST /Items/{itemId}/PlaybackInfo"], "12.0.0"),
  f("jellyfin12.original-language", "jellyfin12", false, "Langue originale (VO)", "Original language", ["GET /Items/{itemId}"], "12.0.0"),
  f("jellyfin12.language-filters", "jellyfin12", false, "Filtrer par langue audio ou de sous-titres", "Filter by audio or subtitle language", ["GET /Items/Filters2", "GET /Items"], "12.0.0"),
  f("jellyfin12.included-in", "jellyfin12", false, "« Fait partie de » : collections d'un titre", "\"Included in\": a title's collections", ["GET /Items/{itemId}/Collections"], "12.0.0"),
  f("jellyfin12.localized-tracks", "jellyfin12", false, "Pistes nommées dans la langue de l'utilisateur", "Tracks named in the user's language", ["POST /Items/{itemId}/PlaybackInfo"], "12.0.0"),
];

export function featureById(id: string): CompatFeature {
  const hit = FEATURES.find((x) => x.id === id);
  if (!hit) throw new Error(`Fonctionnalité inconnue du catalogue : ${id}`);
  return hit;
}
