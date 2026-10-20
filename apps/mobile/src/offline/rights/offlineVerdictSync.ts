import { fetchLibraryVisibility } from "@tentacle-tv/api-client";
import type { LibraryVisibilityDto } from "@tentacle-tv/shared";
import { recordOfflineVerdict } from "./offlineHiddenStore";

/** La clé de la requête du verdict : `rights:changed` l'invalide comme le reste (`applyRightsChanged`). */
export const OFFLINE_VERDICTS_KEY = "offline-verdicts";

export function offlineVerdictsKey(identity: string | null, keptIds: string): readonly unknown[] {
  return [OFFLINE_VERDICTS_KEY, identity, keptIds];
}

/** Vrai quand on peut reposer la question : en ligne, serveur qui sait juger, identité connue. */
export function offlineVerdictsEnabled(input: { online: boolean; capable: boolean; identity: string | null }): boolean {
  return input.online && input.capable && !!input.identity;
}

/**
 * Juge les titres gardés de l'identité et retient le verdict. Aucun titre :
 * rien à demander, l'entrée est effacée. Une erreur remonte : le dernier
 * verdict connu reste en vigueur.
 */
export async function syncOfflineVerdicts(
  identity: string,
  keptIds: readonly string[],
  fetcher: (ids: readonly string[]) => Promise<LibraryVisibilityDto> = (ids) => fetchLibraryVisibility(ids),
): Promise<LibraryVisibilityDto> {
  const verdict = keptIds.length === 0 ? { visible: [], hidden: [], gone: [] } : await fetcher(keptIds);
  recordOfflineVerdict(identity, verdict);
  return verdict;
}
