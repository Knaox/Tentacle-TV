/**
 * Octave — les rangées d'une liste où se mêlent des attentes de l'extension (playlist, « Titres likés ») : une
 * attente dont le titre est déjà dans la bibliothèque se montre comme lui (`libraryFirst`, shared) — Jellyfin
 * fait foi. Une seule question à l'index local du cœur, pour les seules attentes (`useMusicLibraryMatch`).
 */

import { useMemo } from "react";
import { useMusicLibraryMatch } from "../useMusicLibraryMatch";
import { libraryFirst, type ListRow } from "@tentacle-tv/shared/octave";

export function useLibraryFirstRows(rows: readonly ListRow[]): readonly ListRow[] {
  const waiting = useMemo(() => rows.filter((r) => r.pending).map((r) => r.track), [rows]);
  const matches = useMusicLibraryMatch(waiting);
  return useMemo(() => libraryFirst(rows, matches.tracks), [rows, matches.tracks]);
}
