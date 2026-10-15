import { sameUserId, type PickerProfileDto } from "@tentacle-tv/shared";

/**
 * « Changer de profil » (menu de l'avatar du bureau) : ce que « Qui regarde ? »
 * fait de plus qu'à l'ouverture quand il s'ouvre sur l'application DÉJÀ
 * lancée. Module pur (`switchPlan.test.ts`), calqué sur l'intention `switch`
 * de la TV (tv-core `session/profileLaunch.ts`) :
 *
 * - la case « Ne plus proposer à la prochaine ouverture » est là comme à
 *   l'ouverture (tant que l'administration le permet), cochée si cet
 *   ordinateur ne propose déjà plus (shared `pickerStayInitial`) ;
 * - le focus se pose sur le profil en cours, celui qu'on quitterait ;
 * - le profil EN COURS choisi ne rouvre rien — ni code, ni serveur : on y
 *   est déjà, l'écran se referme ; la case vaut quand même (cochée, il est
 *   retenu ; décochée, l'ordinateur propose de nouveau) ;
 * - un autre profil : la case dit si l'ordinateur le retiendra ; décochée, il
 *   n'en retient plus aucun et propose de nouveau « Qui regarde ? » ;
 * - Annuler et Échap ne changent rien du tout.
 */

/** Le profil de la session active : celui de la session de profil, sinon son propre profil. */
export function switchActiveId(profiles: readonly PickerProfileDto[], activeProfileId: string | null): string | null {
  if (activeProfileId !== null) return activeProfileId;
  return profiles.find((profile) => profile.personal)?.userId ?? null;
}

export type SwitchPick =
  /** Le profil en cours : l'écran se referme ; `stay` : la case (`commitStay`). */
  | { kind: "close"; stay: boolean | undefined }
  /** Un autre profil : le serveur l'ouvre (son code d'abord s'il en a un). */
  | { kind: "open" };

/** `allowed` : l'administration permet « Qui regarde ? » à l'ouverture des ordinateurs (la case existe). */
export function switchPick(profileId: string, activeId: string | null, allowed: boolean, checked: boolean): SwitchPick {
  if (activeId !== null && sameUserId(profileId, activeId)) return { kind: "close", stay: commitStay(false, allowed, checked) };
  return { kind: "open" };
}

/**
 * « Ne plus proposer à la prochaine ouverture » au moment du choix — à
 * l'ouverture comme depuis « Changer de profil » : vrai, l'ordinateur retient
 * le profil choisi ; faux, il propose de nouveau « Qui regarde ? » ; absent,
 * rien ne change — « Gérer les profils » n'y touche jamais, et sans la case
 * (coupé par l'administration) il n'y a rien à retenir.
 */
export function commitStay(managing: boolean, allowed: boolean, checked: boolean): boolean | undefined {
  if (managing || !allowed) return undefined;
  return checked;
}
