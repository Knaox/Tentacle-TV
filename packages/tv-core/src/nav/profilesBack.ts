import { isInviteCandidateKey, type ManageView } from "../focus/profilesFocus";

/**
 * Le RETOUR des écrans de profils d'une Apple TV (Famille) — module pur.
 *
 * « Qui regarde ? » est la racine de l'app : Retour y QUITTE l'application
 * (UIKit), comme l'accueil du jumelage — on ne revient jamais dans un profil
 * qu'on vient de quitter. Le pavé du PIN, lui, recule vers les profils.
 *
 * « Gérer les profils » : une page (créer un invité, inviter) recule vers la
 * liste — sauf depuis un résultat de la recherche d'invitation, qui remonte
 * d'abord à la recherche (retour d'essai : une fois dans la liste, on n'y
 * revenait plus) ; la liste sort — vers les réglages d'où l'on venait, ou,
 * ouverte depuis « Qui regarde ? », en refermant la session qu'on avait
 * ouverte pour gérer.
 */

export type ProfilesBackAction = "closePin" | null;

/** `null` : rien à intercepter — Menu reste à UIKit, qui quitte l'application. */
export function profilesBackAction(phase: "loading" | "error" | "picker" | "pin"): ProfilesBackAction {
  return phase === "pin" ? "closePin" : null;
}

export type ManageBackAction = "toSearch" | "toList" | "toSettings" | "toProfiles";

export function manageBackAction(view: ManageView, origin: "profiles" | "settings", focusedKey: string | null = null): ManageBackAction {
  if (view === "invite" && isInviteCandidateKey(focusedKey)) return "toSearch";
  if (view !== "list") return "toList";
  return origin === "profiles" ? "toProfiles" : "toSettings";
}
