/**
 * Octave — retirer des titres de CETTE playlist, côté web : le geste partagé (`usePlaylistRemoval`,
 * api-client), avec l'extension et le toast du web.
 */

import { usePlaylistRemoval as useSharedPlaylistRemoval, type PlaylistTarget } from "@tentacle-tv/api-client";
import type { ListRow } from "@tentacle-tv/shared/octave";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { useOctaveActionsUi } from "./useOctaveActionsUi";

export type { PlaylistTarget };

export function usePlaylistRemoval(playlist: PlaylistTarget | null): (rows: readonly ListRow[], keys: ReadonlySet<string>) => Promise<boolean> {
  return useSharedPlaylistRemoval(useOctaveProvider(), playlist, useOctaveActionsUi());
}
