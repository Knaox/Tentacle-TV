import { canManageGuest, type FamilyDto, type FamilyProfileDto } from "@tentacle-tv/shared";

/** Ce que le panneau d'un profil offre à CE compte. */
export interface ProfilePanelRights {
  /** Poser le code PIN d'un invité. */
  pin: boolean;
  /** Retirer un membre, ou supprimer un invité. */
  remove: boolean;
  /** Régler les droits d'un membre (« Peut créer des invités »). */
  memberRights: boolean;
}

const NONE: ProfilePanelRights = { pin: false, remove: false, memberRights: false };

/**
 * Le panneau d'un profil, selon qui regarde (v2) : le propriétaire gère
 * chaque membre (droits, retrait) et chaque invité (PIN, suppression) ; un
 * membre, les seuls invités qu'il a créés (`canManageGuest`). Personne ne se
 * gère soi-même ici. Module pur, testé — le serveur revérifie chaque geste.
 */
export function profilePanelRights(family: FamilyDto, profile: FamilyProfileDto, me: string | null): ProfilePanelRights {
  if (!me || profile.kind === "owner") return NONE;
  if (profile.kind === "member") {
    const owner = family.rights.manageMembers;
    return { pin: false, remove: owner, memberRights: owner };
  }
  const manage = canManageGuest(family.rights, profile.createdBy, me);
  return { pin: manage, remove: manage, memberRights: false };
}

export function hasPanel(rights: ProfilePanelRights): boolean {
  return rights.pin || rights.remove || rights.memberRights;
}
