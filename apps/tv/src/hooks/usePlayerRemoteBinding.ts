import type { PlayerRemoteHandlers } from "@tentacle-tv/tv-core";
import { usePlayerIntentBinding } from "./usePlayerIntentBinding";

/**
 * La télécommande du lecteur : l'entrée unique de la plateforme
 * (`usePlayerIntentBinding`), sur les deux téléviseurs.
 */
export const usePlayerRemoteBinding: (remote: PlayerRemoteHandlers) => void = usePlayerIntentBinding;
