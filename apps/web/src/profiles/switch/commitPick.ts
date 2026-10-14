import { pickerStayOf, type PickedProfileDto, type PickerProfileDto } from "@tentacle-tv/shared";
import { accountUserId, readActiveProfile, type ActiveProfile } from "../../auth/profileSession";
import { cancelProfileSwitch, clearPickerRequest } from "../../auth/profileEnded";
import { enterProfile, returnToAccount } from "../../auth/sessionSwap";
import { endPipSession } from "../../pictureInPicture/pictureInPictureStore";
import { getBackendBase } from "../../lib/backendBase";
import { markLaunchPassed, noteCurrentProfile } from "../launch/launchState";
import { forgetStayOnDevice, writeStayOnDevice } from "../launch/stayOnDevice";
import { markArrival } from "./arrival";
import type { CurtainProfile } from "./ProfileCurtain";

/**
 * Ce qui suit la réponse du serveur quand on CHOISIT un profil — à
 * l'ouverture comme dans le menu de l'avatar :
 *
 * - son propre profil, depuis la session personnelle : on continue, sans
 *   rechargement (`stay`) ;
 * - son propre profil depuis la session d'un autre : la session personnelle
 *   mise de côté reprend ;
 * - un autre profil : son jeton devient celui de l'application.
 *
 * Dans les deux derniers cas l'application REPART de zéro au nom du nouveau
 * profil : lecture arrêtée (le PiP se ferme), Watch Together quitté, cache
 * persisté effacé, rideau d'arrivée posé, puis rechargement — sockets
 * rouvertes, rien de l'ancien profil à l'écran. L'appelant a appelé
 * `beginProfileSwitch()` AVANT de demander le profil au serveur : la fin de
 * l'ancienne session qu'il pousse alors (« replaced », 401) est la nôtre.
 */

const QUERY_CACHE_KEY = "tentacle_query_cache_v1";
/** Le temps d'une sortie propre : mpv s'arrête, le rideau finit de tomber. */
const SETTLE_MS = 260;
/** Quitter Watch Together : au plus ce temps — le serveur nettoie de lui-même sinon. */
const LEAVE_GROUP_BUDGET_MS = 1500;

export interface CommitContext {
  /** Watch Together, s'il y a un groupe à quitter. */
  leaveGroup?: () => Promise<void>;
  /** Le rideau tombe, au nom du profil choisi (avant le rechargement). */
  onCurtain?: (profile: CurtainProfile) => void;
  /** La bascule a échoué après la chute du rideau (stockage illisible) : il se
   *  relève, et le refus se dit dessous — jamais un rideau qui reste. */
  onCurtainLifted?: () => void;
  /** La page à ouvrir après le rechargement ; l'accueil par défaut. */
  landing?: string;
  /**
   * « Ne plus proposer sur cet appareil » : vrai, l'ordinateur retient le
   * profil choisi ; faux, il n'en retient plus aucun (un changement de profil,
   * une case décochée) ; absent, rien ne change (« Gérer les profils »).
   * Écrit seulement une fois la bascule faite.
   */
  stayOnDevice?: boolean;
}

export type CommitResult = "stay" | "reload";

export function curtainOf(profile: Pick<PickerProfileDto, "userId" | "name" | "color" | "imageTag">): CurtainProfile {
  return { id: profile.userId, name: profile.name, color: profile.color, imageTag: profile.imageTag };
}

export function activeProfileOf(profile: PickerProfileDto): ActiveProfile {
  return { id: profile.userId, name: profile.name, kind: profile.kind, color: profile.color, imageTag: profile.imageTag, hasPin: profile.hasPin };
}

export async function commitPick(picked: PickedProfileDto, context: CommitContext = {}): Promise<CommitResult> {
  const held = readActiveProfile();
  const accountId = accountUserId();
  if (picked.personal && !held) {
    // Aucune bascule n'a lieu : la page ne se recharge pas, et le drapeau posé
    // par `beginProfileSwitch` resterait levé jusqu'à la fermeture — la garde
    // de session tiendrait alors toute fin de la session personnelle pour
    // « la nôtre », et ne la purgerait jamais.
    cancelProfileSwitch();
    markLaunchPassed();
    clearPickerRequest();
    noteCurrentProfile(picked.profile.userId);
    noteStay(picked.profile, accountId, context.stayOnDevice);
    return "stay";
  }
  const curtain = curtainOf(picked.profile);
  context.onCurtain?.(curtain);
  endPipSession();
  await Promise.all([leaveQuietly(context.leaveGroup), wait(SETTLE_MS)]);

  if (!swapSession(picked)) {
    context.onCurtainLifted?.();
    throw new Error("profile session swap failed");
  }

  markLaunchPassed();
  clearPickerRequest();
  noteCurrentProfile(picked.profile.userId);
  noteStay(picked.profile, accountId, context.stayOnDevice);
  markArrival(curtain);
  try {
    localStorage.removeItem(QUERY_CACHE_KEY);
  } catch {
    /* rien à effacer */
  }
  window.location.assign(context.landing ?? "/");
  return "reload";
}

function noteStay(profile: PickerProfileDto, accountId: string | null, stay: boolean | undefined): void {
  if (stay === undefined) return;
  if (stay && accountId) writeStayOnDevice(getBackendBase(), accountId, pickerStayOf(profile));
  else forgetStayOnDevice();
}

/** Les jetons échangés dans le stockage ; faux s'il n'a pas pu l'être (illisible, plein, bloqué). */
function swapSession(picked: PickedProfileDto): boolean {
  try {
    return picked.personal
      ? returnToAccount(localStorage)
      : enterProfile(localStorage, { token: picked.token, user: picked.user, profile: activeProfileOf(picked.profile) });
  } catch {
    return false;
  }
}

async function leaveQuietly(leave: (() => Promise<void>) | undefined): Promise<void> {
  if (!leave) return;
  await Promise.race([leave().catch(() => undefined), wait(LEAVE_GROUP_BUDGET_MS)]);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
