import { useEffect } from "react";
import { useAccountAbilities, useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import {
  OFFLINE_KEEP_RIGHT_KEY,
  keepRightOf,
  lastKeepRight,
  rememberKeepRight,
  type KeepRight,
} from "@tentacle-tv/offline-core";
import { useAccountUserId, useActiveProfile } from "@/family/profiles/profileSessionState";

/**
 * Le hors ligne du mobile appartient au COMPTE DE L'APPAREIL (règle pure :
 * `@tentacle-tv/offline-core` › `rights/offlineOwner`). Une session de PROFIL
 * (membre ou invité) n'en voit rien ; le compte, selon son droit `keepOffline`.
 */

/** Une session de profil est ouverte : le hors ligne n'existe pas pour elle. */
export function useOfflineProfileSession(): boolean {
  return useActiveProfile() !== null;
}

/**
 * Le droit `keepOffline` du compte de l'appareil : la réponse du serveur à la
 * session DU COMPTE (retenue sur l'appareil pour le hors ligne), sinon le
 * dernier mot retenu. Pendant un profil, les droits lus sont ceux du profil :
 * ils ne sont jamais retenus au nom du compte.
 */
export function useAccountKeepRight(): KeepRight {
  const { storage } = useTentacleConfig();
  const abilities = useAccountAbilities();
  const sessionUser = useUserId();
  const accountId = useAccountUserId();
  const profileSession = useOfflineProfileSession();
  const ownSession = !profileSession && !!accountId && sessionUser === accountId;
  const said = ownSession && abilities.kind === "known" ? abilities.abilities.keepOffline : null;

  useEffect(() => {
    if (said === null || !accountId) return;
    const next = rememberKeepRight(storage.getItem(OFFLINE_KEEP_RIGHT_KEY), accountId, said);
    if (next !== null) storage.setItem(OFFLINE_KEEP_RIGHT_KEY, next);
  }, [storage, accountId, said]);

  const lastKnown = lastKeepRight(storage.getItem(OFFLINE_KEEP_RIGHT_KEY), accountId);
  return keepRightOf(ownSession ? abilities : { kind: "pending" }, lastKnown);
}
