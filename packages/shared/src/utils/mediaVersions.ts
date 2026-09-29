/**
 * Les VERSIONS d'un titre : plusieurs fichiers pour un même film — et, depuis
 * Jellyfin 12.0, pour un même épisode (« Série - S01E01 - 1080p.mkv » et
 * « … - 720p.mkv » ne font plus qu'une entrée, à deux sources). Jellyfin les
 * rend dans `MediaSources`, la première étant celle qu'il lit par défaut.
 *
 * Pur, pour toutes les plateformes : la fiche propose le choix, le lecteur lit
 * la version choisie (paramètre `version` de l'adresse de lecture). Une seule
 * source : aucun sélecteur — `mediaVersions` rend une liste vide.
 */

import type { MediaSource } from "../types/media";

/** Le paramètre de l'adresse de lecture qui porte la version choisie (`/watch/:id?version=`). */
export const VERSION_QUERY_PARAM = "version";

export interface MediaVersion {
  /** L'identifiant de la source (`MediaSourceId`), ce que le lecteur demande. */
  id: string;
  /** Le nom que Jellyfin tire du fichier (« 1080p », « Director's Cut »), ou la définition. */
  label: string;
}

type VersionSource = Pick<MediaSource, "Id" | "Name"> & { MediaStreams?: MediaSource["MediaStreams"] };

function versionLabel(source: VersionSource, index: number): string {
  const name = source.Name?.trim();
  if (name) return name;
  const height = source.MediaStreams?.find((s) => s.Type === "Video")?.Height;
  return height ? `${height}p` : `Version ${index + 1}`;
}

/** Les versions à proposer ; vide quand il n'y a rien à choisir (une source, ou aucune). */
export function mediaVersions(sources: readonly VersionSource[] | null | undefined): MediaVersion[] {
  if (!sources || sources.length < 2) return [];
  return sources.map((source, index) => ({ id: source.Id, label: versionLabel(source, index) }));
}

/** La source à lire : la version demandée si le titre l'a, sinon la première (celle de Jellyfin). */
export function pickMediaSource<T extends { Id: string }>(sources: readonly T[] | null | undefined, versionId?: string | null): T | undefined {
  if (!sources || sources.length === 0) return undefined;
  return (versionId ? sources.find((s) => s.Id === versionId) : undefined) ?? sources[0];
}
