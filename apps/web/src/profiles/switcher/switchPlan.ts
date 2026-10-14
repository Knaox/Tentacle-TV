import { sameUserId, type PickerProfileDto } from "@tentacle-tv/shared";

/**
 * « Changer de profil » (menu de l'avatar du bureau) : ce que « Qui regarde ? »
 * fait de plus qu'à l'ouverture quand il s'ouvre sur l'application DÉJÀ
 * lancée. Module pur (`switchPlan.test.ts`), calqué sur l'intention `switch`
 * de la TV (tv-core `session/profileLaunch.ts`) :
 *
 * - la case « Ne plus proposer sur cet appareil » arrive DÉCOCHÉE : le choix
 *   vaut pour un profil, jamais pour le suivant (sinon le profil retenu pour
 *   un enfant le serait aussi pour le compte choisi ensuite) ;
 * - le focus se pose sur le profil en cours, celui qu'on quitterait ;
 * - le profil EN COURS choisi ne rouvre rien — ni code, ni serveur : on y
 *   est déjà, l'écran se referme ; seule la case cochée y change quelque
 *   chose (l'ordinateur retient désormais ce profil) ;
 * - un autre profil : la case dit si l'ordinateur le retiendra ; décochée, il
 *   n'en retient plus aucun (le profil retenu est toujours celui en cours) ;
 * - Annuler et Échap ne changent rien du tout.
 */

/** Le profil de la session active : celui de la session de profil, sinon son propre profil. */
export function switchActiveId(profiles: readonly PickerProfileDto[], activeProfileId: string | null): string | null {
  if (activeProfileId !== null) return activeProfileId;
  return profiles.find((profile) => profile.personal)?.userId ?? null;
}

export type SwitchPick =
  /** Le profil en cours : l'écran se referme ; `keepHere` : l'ordinateur le retient désormais. */
  | { kind: "close"; keepHere: boolean }
  /** Un autre profil : le serveur l'ouvre (son code d'abord s'il en a un). */
  | { kind: "open" };

export function switchPick(profileId: string, activeId: string | null, atLaunch: boolean, checked: boolean): SwitchPick {
  if (activeId !== null && sameUserId(profileId, activeId)) return { kind: "close", keepHere: atLaunch && checked };
  return { kind: "open" };
}

/**
 * « Ne plus proposer sur cet appareil » au moment de la bascule (`commitPick`) :
 * vrai, l'ordinateur retient le profil choisi ; faux, il n'en retient plus
 * aucun ; absent, rien ne change.
 *
 * - « Gérer les profils » n'y touche jamais ;
 * - à l'ouverture, la case vaut si le compte demande qui regarde, sinon rien
 *   ne change ;
 * - depuis « Changer de profil », un changement de profil oublie le profil
 *   retenu, sauf case cochée (le menu de l'avatar l'a toujours fait).
 */
export function commitStay(mode: "launch" | "switch", managing: boolean, atLaunch: boolean, checked: boolean): boolean | undefined {
  if (managing) return undefined;
  if (mode === "switch") return atLaunch && checked;
  return atLaunch ? checked : undefined;
}
