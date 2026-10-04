import type { ManageView } from "../focus/profilesFocus";

/**
 * Le RETOUR des écrans de profils d'une Apple TV (Famille) — module pur.
 *
 * « Qui regarde ? » est la racine de l'app : Retour y QUITTE l'application
 * (UIKit), comme l'accueil du jumelage — on ne revient jamais dans un profil
 * qu'on vient de quitter. Le pavé du PIN, lui, recule vers les profils.
 *
 * « Gérer les profils » : une page (créer un invité, inviter) recule vers la
 * liste ; la liste sort — vers les réglages d'où l'on venait, ou, ouverte
 * depuis « Qui regarde ? », en refermant la session du propriétaire qu'on
 * avait ouverte pour gérer.
 */

export type ProfilesBackAction = "closePin" | null;

/** `null` : rien à intercepter — Menu reste à UIKit, qui quitte l'application. */
export function profilesBackAction(phase: "loading" | "error" | "picker" | "pin"): ProfilesBackAction {
  return phase === "pin" ? "closePin" : null;
}

export type ManageBackAction = "toList" | "toSettings" | "toProfiles";

export function manageBackAction(view: ManageView, origin: "profiles" | "settings"): ManageBackAction {
  if (view !== "list") return "toList";
  return origin === "profiles" ? "toProfiles" : "toSettings";
}
