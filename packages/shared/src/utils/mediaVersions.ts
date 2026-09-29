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

const videoHeight = (source: VersionSource): number | undefined =>
  source.MediaStreams?.find((s) => s.Type === "Video")?.Height;

function versionLabel(source: VersionSource, index: number): string {
  const name = source.Name?.trim();
  if (name) return name;
  const height = videoHeight(source);
  return height ? `${height}p` : `Version ${index + 1}`;
}

/** La définition d'une version : celle du flux vidéo, sinon celle que dit son nom (« 720p »). */
function definition(source: VersionSource, label: string): number {
  return videoHeight(source) ?? Number(/(\d{3,4})p\b/i.exec(label)?.[1] ?? 0);
}

/**
 * Les versions à proposer ; vide quand il n'y a rien à choisir (une source, ou
 * aucune). Dans un ordre STABLE — définition décroissante, puis nom : Jellyfin
 * met en tête la dernière version lue par le compte, et les pastilles ne
 * doivent pas changer de place d'une visite à l'autre. La version par défaut,
 * elle, reste la première de Jellyfin (`pickMediaSource`).
 */
export function mediaVersions(sources: readonly VersionSource[] | null | undefined): MediaVersion[] {
  if (!sources || sources.length < 2) return [];
  return sources
    .map((source, index) => {
      const label = versionLabel(source, index);
      return { id: source.Id, label, rank: definition(source, label) };
    })
    .sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label, undefined, { numeric: true }))
    .map(({ id, label }) => ({ id, label }));
}

/** La source à lire : la version demandée si le titre l'a, sinon la première (celle de Jellyfin). */
export function pickMediaSource<T extends { Id: string }>(sources: readonly T[] | null | undefined, versionId?: string | null): T | undefined {
  if (!sources || sources.length === 0) return undefined;
  return (versionId ? sources.find((s) => s.Id === versionId) : undefined) ?? sources[0];
}
