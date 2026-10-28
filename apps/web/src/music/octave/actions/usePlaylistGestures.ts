/** Octave — les gestes de playlist sur un titre : le crochet vit dans api-client (`usePlaylistGestures`), le même pour le mobile. */

import { usePlaylistGestures as useSharedPlaylistGestures, type PlaylistGestures } from "@tentacle-tv/api-client";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { useOctaveActionsUi } from "./useOctaveActionsUi";

export { isLibraryTrack, type PlaylistGestures } from "@tentacle-tv/api-client";

export function usePlaylistGestures(): PlaylistGestures {
  return useSharedPlaylistGestures(useOctaveProvider(), useOctaveActionsUi());
}
