/**
 * Les VOISINS de saison d'un épisode — ceux dont l'audio va servir de témoin.
 *
 * Une seule requête, `adjacentTo` : Jellyfin rend le précédent, l'épisode
 * lui-même et le suivant, dans l'ordre de diffusion (vérifié sur 10.11.8).
 * Mais cette liste a ses pièges, chacun payé par un faux témoin :
 *
 *  - l'épisode courant y figure (à écarter) ; un item absent de la saison (un
 *    spécial) fait rendre le PREMIER épisode comme « suivant » ;
 *  - deux fichiers pour le même numéro sont voisins l'un de l'autre — même
 *    contenu, l'appariement matcherait toute la fenêtre ;
 *  - les épisodes manquants « virtuels » et les spéciaux intercalés s'y
 *    glissent quand l'administrateur les affiche.
 *
 * D'où les filtres : un vrai épisode, de la même saison, d'un numéro différent
 * et proche (un trou de diffusion toléré), avec un fichier et une durée. Deux
 * voisins au plus — le précédent et le suivant, ou les deux du même côté en
 * bord de saison.
 *
 * `null` veut dire « Jellyfin n'a pas répondu » (transitoire, à retenter) ;
 * `[]` veut dire « il n'y a personne » (une saison d'un seul épisode, pour
 * l'instant).
 */

import { getConfigValue } from "./configStore";
import { fetchJson, type EpisodeContext } from "./jellyfinSegments";
import { TICKS_PER_MS } from "../playback/segmentTypes";

/** Un voisin dont l'audio peut servir de témoin. */
export interface NeighbourEpisode {
  id: string;
  indexNumber: number;
  runtimeMs: number;
  /** La source par défaut du voisin — celle dont la durée fait foi. */
  mediaSourceId: string;
  sourceBitrate: number | null;
}

/** Au-delà de cet écart de numéro, ce n'est plus un voisin (un trou toléré). */
export const NEIGHBOUR_MAX_INDEX_GAP = 2;

/** Deux témoins suffisent : le précédent et le suivant. */
export const NEIGHBOUR_MAX_COUNT = 2;

/** Les identifiants Jellyfin qu'on accepte d'interpoler dans une URL. */
const SAFE_ID = /^[A-Za-z0-9-]+$/;

interface EpisodeDto {
  Id?: string;
  Type?: string;
  LocationType?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  RunTimeTicks?: number;
  MediaSources?: Array<{ Id?: string; Bitrate?: number }>;
}

/** Même besoin de `userId` que l'item ; `MediaSources` pour la source par défaut. */
export function neighboursUrl(url: string, episode: EpisodeContext, itemId: string): string {
  const adminId = getConfigValue("admin_jellyfin_id");
  const user = adminId ? `&userId=${encodeURIComponent(adminId)}` : "";
  return (
    `${url}/Shows/${episode.seriesId}/Episodes?seasonId=${episode.seasonId}` +
    `&adjacentTo=${itemId}${user}&isMissing=false&fields=MediaSources`
  );
}

/** Les ids des voisins comparés, triés — la clé qui dit « la saison a-t-elle grandi ? ». */
export function neighbourKey(neighbours: readonly NeighbourEpisode[]): string {
  return neighbours
    .map((n) => n.id)
    .sort()
    .join(",");
}

/** Le tri : les voisins qui passent les filtres, les plus proches d'abord. */
export function pickNeighbours(
  items: readonly unknown[],
  episode: EpisodeContext,
  itemId: string,
): NeighbourEpisode[] {
  const candidates: NeighbourEpisode[] = [];
  for (const raw of items) {
    if (typeof raw !== "object" || raw === null) continue;
    const dto = raw as EpisodeDto;
    if (typeof dto.Id !== "string" || dto.Id === itemId || !SAFE_ID.test(dto.Id)) continue;
    if (dto.Type !== "Episode" || dto.LocationType === "Virtual") continue;
    if (typeof dto.IndexNumber !== "number") continue;
    if (episode.seasonNumber !== null && dto.ParentIndexNumber !== episode.seasonNumber) continue;
    if (episode.indexNumber !== null) {
      const gap = Math.abs(dto.IndexNumber - episode.indexNumber);
      if (gap === 0 || gap > NEIGHBOUR_MAX_INDEX_GAP) continue;
    }
    const ticks = typeof dto.RunTimeTicks === "number" ? dto.RunTimeTicks : 0;
    if (ticks <= 0) continue;
    const source = dto.MediaSources?.[0];
    if (typeof source?.Id !== "string" || source.Id === "") continue;
    const bitrate = source.Bitrate;
    candidates.push({
      id: dto.Id,
      indexNumber: dto.IndexNumber,
      runtimeMs: Math.round(ticks / TICKS_PER_MS),
      mediaSourceId: source.Id,
      sourceBitrate: typeof bitrate === "number" && bitrate > 0 ? bitrate : null,
    });
  }
  const anchor = episode.indexNumber;
  if (anchor !== null) {
    candidates.sort(
      (a, b) => Math.abs(a.indexNumber - anchor) - Math.abs(b.indexNumber - anchor),
    );
  }
  return candidates.slice(0, NEIGHBOUR_MAX_COUNT);
}

export async function fetchEpisodeNeighbours(
  url: string,
  apiKey: string,
  episode: EpisodeContext,
  itemId: string,
): Promise<NeighbourEpisode[] | null> {
  const raw = await fetchJson(neighboursUrl(url, episode, itemId), apiKey);
  if (typeof raw !== "object" || raw === null) return null;
  const items = (raw as { Items?: unknown }).Items;
  if (!Array.isArray(items)) return null;
  return pickNeighbours(items, episode, itemId);
}
