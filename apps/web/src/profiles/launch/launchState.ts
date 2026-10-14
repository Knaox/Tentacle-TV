import type { PickerProfilesDto } from "@tentacle-tv/shared";
import { notifyProfileSessionChange } from "../../auth/profileSession";
import { forgetProfileSession } from "../../auth/sessionSwap";
import type { LaunchMirror } from "./launchDecision";
import { forgetStayOnDevice } from "./stayOnDevice";

/**
 * Ce que « Qui regarde ? » garde entre deux ouvertures (le MIROIR, stockage
 * local : la dernière réponse du serveur, par serveur et par compte) et dans
 * l'exécution en cours (le choix est FAIT, stockage de session : il survit
 * aux rechargements d'une bascule, pas à la fermeture de l'application).
 * Aucun secret ici : des noms, des couleurs, des drapeaux — jamais un jeton
 * ni un code.
 *
 * ⚠️ Clés traversées par une chaîne : jamais renommées.
 */
export const LAUNCH_MIRROR_KEY = "tentacle_profile_launch";
export const LAUNCH_PASSED_KEY = "tentacle_profile_launch_passed";

function isListing(value: unknown): value is PickerProfilesDto {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PickerProfilesDto>;
  return Array.isArray(candidate.profiles) && typeof candidate.currentProfileId === "string"
    && !!candidate.account && typeof candidate.account.userId === "string";
}

export function readLaunchMirror(): LaunchMirror | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAUNCH_MIRROR_KEY) ?? "null") as Partial<LaunchMirror> | null;
    if (!parsed || typeof parsed.server !== "string" || typeof parsed.accountId !== "string") return null;
    const listing = isListing(parsed.listing) ? parsed.listing : null;
    return { server: parsed.server, accountId: parsed.accountId, capable: parsed.capable === true && listing !== null, listing };
  } catch {
    return null;
  }
}

export function writeLaunchMirror(mirror: LaunchMirror): void {
  try {
    localStorage.setItem(LAUNCH_MIRROR_KEY, JSON.stringify(mirror));
  } catch {
    /* stockage plein ou bloqué : la prochaine ouverture demandera au serveur */
  }
}

/** Le profil en cours sur cet appareil a changé (une bascule) : le miroir le suit. */
export function noteCurrentProfile(profileId: string): void {
  const mirror = readLaunchMirror();
  if (!mirror?.listing) return;
  writeLaunchMirror({ ...mirror, listing: { ...mirror.listing, currentProfileId: profileId } });
}

export function forgetLaunchMirror(): void {
  try {
    localStorage.removeItem(LAUNCH_MIRROR_KEY);
  } catch {
    /* rien à oublier */
  }
}

export function launchPassed(): boolean {
  try {
    return sessionStorage.getItem(LAUNCH_PASSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Le profil est choisi pour cette exécution (ou la session vient d'une connexion par mot de passe). */
export function markLaunchPassed(): void {
  try {
    sessionStorage.setItem(LAUNCH_PASSED_KEY, "1");
  } catch {
    /* stockage de session indisponible : le sélecteur se reproposera au rechargement */
  }
}

/**
 * Une connexion par mot de passe dans cette exécution : la session est la
 * session PERSONNELLE (le profil est « choisi »), et ce qui restait d'une
 * session de profil passée — sa marque, la réserve d'un compte, laissées par
 * une sortie qui ignorait ces clés (déconnexion depuis l'écran hors ligne,
 * changement de serveur) — est oublié : la réserve d'un autre compte ne
 * survit jamais à une connexion.
 */
export function noteFreshLogin(): void {
  markLaunchPassed();
  forgetPastProfileSession();
}

/**
 * La session vient de finir (plus de compte connecté) : rien de la session de
 * profil ne lui survit — ni sa marque, ni la réserve qui garde le jeton
 * personnel du compte, ni « Ne plus proposer sur cet appareil » (comme une TV
 * déjumelée) —, quelle que soit la sortie qui l'a fermée.
 */
export function noteLoggedOut(): void {
  forgetPastProfileSession();
}

function forgetPastProfileSession(): void {
  forgetStayOnDevice();
  try {
    forgetProfileSession(localStorage);
  } catch {
    /* stockage indisponible : rien à oublier */
  }
  notifyProfileSessionChange();
}
