import {
  personalPickerProfile,
  pickerLaunch,
  type PickerProfilesDto,
} from "@tentacle-tv/shared";

/**
 * « Qui regarde ? » à l'ouverture du bureau : les DÉCISIONS, pures
 * (`launchDecision.test.ts`). La règle du serveur est celle de shared
 * (`pickerLaunch`) ; ici, seulement ce que le bureau y ajoute :
 *
 * - décider SANS ATTENDRE quand on le peut : la dernière réponse du serveur
 *   est gardée sur la machine (le MIROIR, par compte) et relue en fond — comme
 *   la rangée de la TV ; sans miroir (premier lancement), l'application
 *   s'ouvre comme avant et la réponse du serveur vaut si elle arrive dans
 *   l'attente bornée — aucun écran d'attente pour qui n'a pas de profils ;
 * - un profil déjà choisi dans cette exécution n'est pas redemandé (une
 *   bascule recharge la page) — sauf ce qui touche à la SÉCURITÉ, revérifié à
 *   chaque ouverture : une session de profil que le serveur ne connaît plus,
 *   ou un profil que le serveur dit en cours sans que l'application en ait le
 *   jeton (revenir au compte sans son PIN serait un contournement) ;
 * - une session de profil terminée ramène au sélecteur QUEL QUE SOIT le
 *   réglage (`requested`), sauf compte seul et sans code.
 */

export type LaunchVerdict =
  /** L'application, tout de suite (vérifiée en fond). */
  | "app"
  /** Le sélecteur, tout de suite, depuis le miroir (relu en fond). */
  | "picker"
  /** La session d'un profil a pris fin : rien avant la réponse du serveur. */
  | "check";

/**
 * La dernière réponse du serveur, gardée sur la machine (aucun secret : des
 * noms, des couleurs, des drapeaux) — par serveur ET par compte.
 */
export interface LaunchMirror {
  /** L'adresse du serveur Tentacle qui a répondu. */
  server: string;
  /** Le compte de l'application à qui elle appartient. */
  accountId: string;
  /** Le serveur déclare `family.desktopProfiles` (et la Famille). */
  capable: boolean;
  /** La famille et la préférence ; null sans la capacité. */
  listing: PickerProfilesDto | null;
}

export interface LaunchInputs {
  desktop: boolean;
  /** Une session existe (personnelle ou de profil). */
  authed: boolean;
  /** Un profil a déjà été choisi dans cette exécution (ou une connexion par mot de passe). */
  passed: boolean;
  /** Le sélecteur est exigé : la session d'un profil a pris fin. */
  requested: boolean;
  /** L'adresse du serveur de l'application. */
  server: string;
  /** Le compte de l'application (même pendant un profil). */
  accountId: string | null;
  /** Le profil dont l'application garde la session ; null : la session personnelle. */
  heldProfileId: string | null;
  /** La dernière réponse du serveur gardée sur la machine, ou null. */
  mirror: LaunchMirror | null;
}

export function launchVerdict(input: LaunchInputs): LaunchVerdict {
  if (!input.desktop || !input.authed || !input.accountId) return "app";
  if (input.requested) return "check";
  if (input.passed) return "app";
  const mirror = input.mirror?.accountId === input.accountId && input.mirror.server === input.server ? input.mirror : null;
  if (!mirror) return "app";
  if (!mirror.capable || !mirror.listing) return "app";
  return pickerLaunch(mirror.listing, held(input.heldProfileId)) === "picker" ? "picker" : "app";
}

/** Ce que la réponse FRAÎCHE du serveur fait faire. `ended` : la session de profil gardée est morte. */
export type LaunchOutcome = "picker" | "app" | "ended";

/**
 * À l'ouverture (sélecteur montré depuis le miroir, ou attente) : la règle
 * entière, préférence comprise.
 */
export function launchOutcome(listing: PickerProfilesDto, heldProfileId: string | null, requested: boolean): LaunchOutcome {
  if (requested) {
    const own = personalPickerProfile(listing);
    return requestedPickerNeeded(listing.profiles.length, own?.hasPin === true) ? "picker" : "app";
  }
  const verdict = pickerLaunch(listing, held(heldProfileId));
  if (verdict === "picker") return "picker";
  return verdict === "personal" && heldProfileId !== null ? "ended" : "app";
}

/**
 * L'application déjà ouverte (profil choisi dans cette exécution, ou décidé
 * depuis le miroir) : seulement la sécurité — jamais la préférence, qui ne
 * vaut qu'à l'ouverture.
 */
export function verifyOutcome(listing: PickerProfilesDto, heldProfileId: string | null): LaunchOutcome {
  const current = listing.currentProfileId;
  if (heldProfileId !== null) return current === heldProfileId ? "app" : "ended";
  return current !== listing.account.userId ? "picker" : "app";
}

/** Le sélecteur s'impose dès deux profils. */
export const LAUNCH_MIN_PROFILES = 2;

/**
 * Le sélecteur EXIGÉ (session de profil terminée) : seulement s'il reste un
 * choix à faire ou un code à saisir — le compte seul, sans code, s'ouvre.
 */
export function requestedPickerNeeded(profileCount: number, ownHasPin: boolean): boolean {
  return profileCount >= LAUNCH_MIN_PROFILES || ownHasPin;
}

/** L'attente bornée : une réponse plus tardive ne couvre plus l'application ouverte que pour la sécurité
 *  (la préférence vaudra à l'ouverture suivante, d'après le miroir). */
export const LAUNCH_CHECK_BUDGET_MS = 1500;

function held(profileId: string | null): { profileId: string } | null {
  return profileId === null ? null : { profileId };
}
