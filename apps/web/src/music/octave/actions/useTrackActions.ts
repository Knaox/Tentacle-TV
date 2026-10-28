/** Octave — les gestes sur un titre (cœur, playlists) : le crochet vit dans api-client (`useTrackActions`), le même pour le mobile. */

import { useTrackActions as useSharedTrackActions, type TrackActions } from "@tentacle-tv/api-client";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { useOctaveActionsUi } from "./useOctaveActionsUi";

export type { TrackActions } from "@tentacle-tv/api-client";

export function useTrackActions(): TrackActions {
  return useSharedTrackActions(useOctaveProvider(), useOctavePlayer(), useOctaveActionsUi());
}
