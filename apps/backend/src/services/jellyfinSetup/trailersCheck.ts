import type { SetupCheck, SetupTrailers } from "../jellyfinCompat/setupContract";
import type { Loose } from "./setupSnapshot";
import type { TrailerCounts } from "./trailerCoverage";

/**
 * « Bandes-annonces » : pourquoi un serveur n'en montre aucune, mesuré.
 *
 * Quatre causes, dans l'ordre où on les cherche :
 * 1. TMDB écarté — le greffon TMDb coupé, ou retiré des fournisseurs d'une
 *    bibliothèque : sans lui, Jellyfin ne reçoit aucune `RemoteTrailers` ;
 * 2. les métadonnées jamais complétées — des titres connus de TMDB sans
 *    bande-annonce : « Rechercher les métadonnées manquantes » les comble
 *    sans rien remplacer de ce qui existe ;
 * 3. Jellyseerr — branché par Vigie, chaque fiche y cherche aussi les vidéos
 *    TMDB (`/api/tmdb/trailers`), bien plus nombreuses ;
 * 4. la version de Jellyfin — ce que la compatibilité dit des bonus et
 *    bandes-annonces (zone `extras` du manifeste) sur la version installée.
 */

/** Au-dessous de la moitié des titres que TMDB connaît, on cherche pourquoi. */
export const LOW_COVERAGE = 0.5;

export interface TrailersContext {
  coverage: TrailerCounts | null;
  jellyseerr: boolean;
  compatGaps: SetupTrailers["compatGaps"];
}

export function trailersCheck(videos: Loose[] | null, tmdb: SetupCheck, context: TrailersContext): SetupCheck {
  const { coverage, jellyseerr, compatGaps } = context;
  const refreshing = videos?.some((library) => library.RefreshStatus === "Active") ?? false;
  // TMDB coupé : c'est LA cause, et son remède est dans le tableau de bord.
  const tmdbBlocked = tmdb.state === "todo";
  const trailers: SetupTrailers | null = coverage
    ? { ...coverage, tmdbBlocked, jellyseerr, refreshing, compatGaps }
    : null;
  const known = trailers !== null && trailers.titles > 0 && tmdb.state !== "unknown";
  const ratio = trailers && trailers.withTmdb > 0 ? trailers.withTrailer / trailers.withTmdb : 0;
  const state = !known ? "unknown" : !tmdbBlocked && (ratio >= LOW_COVERAGE || jellyseerr) ? "done" : "todo";
  return {
    id: "trailers",
    level: "recommended",
    state,
    libraries: tmdb.libraries,
    current: null,
    missingTmdb: null,
    plugins: null,
    task: null,
    trailers,
    action: state === "todo" && !tmdbBlocked && !refreshing ? "refreshMissingMetadata" : null,
    dashboardPath: tmdb.dashboardPath,
  };
}
