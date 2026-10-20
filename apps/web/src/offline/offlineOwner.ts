/**
 * Le hors ligne du bureau appartient au COMPTE DE L'APPAREIL — celui qui s'y
 * est connecté, jamais le profil ouvert par « Qui regarde ? » (règle pure :
 * `@tentacle-tv/offline-core` › `rights/offlineOwner`, la même que le mobile).
 * Le moteur de téléchargement tourne avec SON jeton ; ses droits disent ce que
 * l'interface montre.
 */

import { useEffect } from "react";
import { useAccountAbilities, useUserId } from "@tentacle-tv/api-client";
import {
  OFFLINE_KEEP_RIGHT_KEY,
  keepRightOf,
  lastKeepRight,
  offlineOwnerOf,
  rememberKeepRight,
  type KeepRight,
  type OfflineOwner,
} from "@tentacle-tv/offline-core";

const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
};

/** Le compte de l'appareil et son jeton, même pendant un profil ; null sans compte connecté. */
export function readOfflineOwner(): OfflineOwner | null {
  return offlineOwnerOf(safeStorage);
}

/**
 * Le droit `keepOffline` du compte de l'appareil : la réponse du serveur à la
 * session DU COMPTE (retenue pour le hors ligne, où l'on ne peut pas reposer la
 * question), sinon le dernier mot retenu. Pendant un profil, les droits lus
 * sont ceux du profil : jamais retenus au nom du compte.
 */
export function useAccountKeepRight(profileSession: boolean): KeepRight {
  const abilities = useAccountAbilities();
  const sessionUser = useUserId();
  const accountId = readOfflineOwner()?.userId ?? null;
  const ownSession = !profileSession && !!accountId && sessionUser === accountId;
  const said = ownSession && abilities.kind === "known" ? abilities.abilities.keepOffline : null;

  useEffect(() => {
    if (said === null || !accountId) return;
    const next = rememberKeepRight(safeStorage.getItem(OFFLINE_KEEP_RIGHT_KEY), accountId, said);
    if (next === null) return;
    try {
      localStorage.setItem(OFFLINE_KEEP_RIGHT_KEY, next);
    } catch {
      /* stockage plein ou bloqué : le serveur sera relu à la prochaine connexion */
    }
  }, [accountId, said]);

  return keepRightOf(ownSession ? abilities : { kind: "pending" }, lastKeepRight(safeStorage.getItem(OFFLINE_KEEP_RIGHT_KEY), accountId));
}
