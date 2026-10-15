import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import type { FamilyProfileColor } from "@tentacle-tv/shared";
import { railSetupTargetIds } from "@tentacle-tv/tv-core";
import { railPinningStore } from "../../components/nav/railPinning";
import { profileAvatarUri } from "../profiles/profilesModel";
import { useTvFamilyListing } from "../profiles/useTvFamilyListing";

/**
 * « Appliquer à d'autres profils » — réservé au PROPRIÉTAIRE de la famille,
 * sur CETTE TV : les autres profils de la famille (membres et invités), tels
 * que « Qui regarde ? » les connaît (`useTvFamilyListing`, une lecture
 * partagée, en session de profil seulement). Le rôle vient de cette liste,
 * donc du serveur (tv-core `railSetupTargetIds`). Membre, invité, TV sans
 * famille ou propriétaire seul : liste vide, `apply` sans effet.
 *
 * Appliquer copie la disposition du propriétaire (masquées + ordre) chez
 * chacun, sa préconfiguration marquée faite. Une bibliothèque qu'un profil
 * n'a pas le droit de voir n'existe simplement pas chez lui : sa clé est
 * ignorée au rendu (`applyRailOrder`).
 */

export interface RailSetupTarget {
  userId: string;
  name: string;
  color: FamilyProfileColor;
  /** Son portrait (par le proxy du serveur) ; absent : l'initiale sur sa couleur. */
  avatarUri?: string;
  guest: boolean;
  /** Sa préconfiguration est déjà faite sur cette TV. */
  setupDone: boolean;
}

export interface RailSetupTargets {
  targets: RailSetupTarget[];
  /** Copie la disposition de l'identité active chez ces profils (les autres identifiants sont ignorés). */
  apply: (userIds: readonly string[]) => void;
}

export function useRailSetupTargets(): RailSetupTargets {
  const { storage } = useTentacleConfig();
  const listing = useTvFamilyListing();
  const { identity } = useSyncExternalStore(railPinningStore.subscribe, railPinningStore.readSnapshot);
  const rails = useSyncExternalStore(railPinningStore.subscribe, railPinningStore.readProfiles);
  const serverUrl = listing ? storage.getItem("tentacle_server_url") : null;

  const targets = useMemo<RailSetupTarget[]>(() => {
    const profiles = listing?.profiles ?? [];
    const ids = new Set(railSetupTargetIds(profiles, identity));
    return profiles
      .filter((profile) => ids.has(profile.userId))
      .map((profile) => ({
        userId: profile.userId,
        name: profile.name,
        color: profile.color,
        avatarUri: profileAvatarUri(serverUrl, profile.userId, profile.imageTag),
        guest: profile.kind === "guest",
        setupDone: rails[profile.userId]?.setupDone ?? false,
      }));
  }, [listing, identity, rails, serverUrl]);

  const apply = useCallback(
    (userIds: readonly string[]) => {
      if (!identity) return;
      const allowed = new Set(targets.map((target) => target.userId));
      railPinningStore.applyLayoutTo(identity, userIds.filter((userId) => allowed.has(userId)));
    },
    [identity, targets],
  );

  return useMemo(() => ({ targets, apply }), [targets, apply]);
}
