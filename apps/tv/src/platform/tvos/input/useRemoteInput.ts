import { createRemoteHooks } from "../../shared/remoteHooks";
import { tvosInput, TVOS_REMOTE_SUPPORTED } from "./remoteInput";

/**
 * Les crochets de l'entrée unique de l'Apple TV — VOIR passer les intentions
 * (`useRemoteIntents`), en PRENDRE dans un contexte (`useRemoteContext`),
 * savoir D'AVANCE qui en prendrait une (`useTakenAhead`). Écrits une fois
 * pour toutes les plateformes (`platform/shared/remoteHooks.ts`), posés ici
 * sur l'entrée de la Siri Remote.
 */
export type { RemoteContextOptions } from "../../shared/remoteHooks";

export const { useRemoteIntents, useRemoteContext, useTakenAhead } = createRemoteHooks(tvosInput, TVOS_REMOTE_SUPPORTED);
