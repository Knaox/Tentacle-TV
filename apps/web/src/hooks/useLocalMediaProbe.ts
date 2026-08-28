/**
 * Sonde d'existence du média LOCAL courant — le discriminant de la
 * classification média/lecteur (`playbackFailure.ts`).
 *
 * Rappelée APRÈS un échec de chargement, elle re-résout
 * `downloads_local_source` : le main refait le `statSync` (et marque le
 * téléchargement `error/missing` en base — effet de bord VOULU, la page
 * Téléchargements dira la vérité).
 *
 * # Pourquoi un invoke direct, et pas la query TanStack `["local-source"]`
 *
 * Rafraîchir la query mettrait le cache à jour → `localSource` deviendrait
 * `null` → `useDesktopSource` basculerait le `src` sur l'URL distante PENDANT
 * l'écran d'erreur : une relance silencieuse, à rebours du choix explicite
 * (« Réessayer ») qu'on veut laisser à l'utilisateur.
 *
 * # Les trois réponses
 *
 * - `true`  : un fichier local lisible existe encore (le défaut est ailleurs).
 * - `false` : réponse FORMELLE du main — plus de fichier lisible (média).
 * - `null`  : sonde impossible (IPC en échec) — jamais « média » sans preuve.
 */

import { useCallback } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { invoke, supportsDownloads } from "../desktop/bridge";

export type LocalMediaProbe = () => Promise<boolean | null>;

export function useLocalMediaProbe(input: {
  isLocalPlayback: boolean;
  itemId: string | undefined;
}): LocalMediaProbe | undefined {
  const userId = useUserId();
  const { isLocalPlayback, itemId } = input;

  const probe = useCallback<LocalMediaProbe>(async () => {
    if (!supportsDownloads() || !userId || !itemId) return null;
    try {
      const source = await invoke<unknown>("downloads_local_source", { userId, itemId });
      return source !== null;
    } catch {
      return null;
    }
  }, [userId, itemId]);

  return isLocalPlayback ? probe : undefined;
}
