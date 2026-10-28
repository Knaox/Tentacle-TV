/** Octave — les droits d'ajout du compte : le crochet vit dans api-client (`useAcquireRights`), le même pour le mobile. */

import { useAcquireRights as useSharedAcquireRights, type AcquireRights } from "@tentacle-tv/api-client";
import { useOctaveActionsUi } from "../actions/useOctaveActionsUi";
import { useOctaveProvider } from "../mode/useOctaveProvider";

export type { AcquireRights } from "@tentacle-tv/api-client";

export function useAcquireRights(): AcquireRights {
  return useSharedAcquireRights(useOctaveProvider(), useOctaveActionsUi().t);
}
