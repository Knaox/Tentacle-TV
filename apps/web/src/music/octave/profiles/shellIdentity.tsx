/**
 * Octave — QUI est dans la coquille, pour son menu : le profil actuel de la famille s'il y en a une (sa photo, ou
 * son initiale sur sa couleur), sinon le compte de la session (`tentacle_user` : son nom, sa photo Jellyfin).
 */

import type { ReactNode } from "react";
import { FamilyAvatar } from "../../../family/FamilyAvatar";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import type { OctaveProfileMenu } from "./octaveProfileMenu";

export interface ShellIdentity {
  name: string;
  avatar: (size: number) => ReactNode;
}

/** Le compte de la session (`tentacle_user`, la clé de l'authentification), ou null hors session. */
function readAccount(): { id: string; name: string; imageTag: string | null } | null {
  try {
    const user = JSON.parse(localStorage.getItem("tentacle_user") ?? "null") as { Id?: string; Name?: string; PrimaryImageTag?: string } | null;
    if (!user?.Id) return null;
    return { id: user.Id, name: user.Name ?? "", imageTag: user.PrimaryImageTag ?? null };
  } catch {
    return null;
  }
}

export function shellIdentityOf(menu: OctaveProfileMenu | null): ShellIdentity | null {
  const current = menu?.current;
  if (current) {
    return {
      name: current.name,
      avatar: (size) => <FamilyAvatar userId={current.userId} name={current.name} color={current.color} imageTag={current.imageTag} size={size} />,
    };
  }
  const account = readAccount();
  if (!account) return null;
  return {
    name: account.name,
    avatar: (size) => <UserAvatar userId={account.id} name={account.name} hasAvatar={account.imageTag !== null} imageTag={account.imageTag ?? undefined} size={size} />,
  };
}
