/**
 * À QUI appartient le hors ligne d'un appareil — règle de Damien (21/10),
 * commune au mobile et au bureau : au COMPTE AVEC LEQUEL L'APPAREIL S'EST
 * CONNECTÉ (le compte de l'appareil), jamais au propriétaire de la Famille,
 * jamais au profil ouvert par « Qui regarde ? ».
 *
 * - Seul ce compte garde des titres, les voit (page « Sur cet appareil »,
 *   rangées, marqueurs, suivi en direct) et les lit hors connexion. Dans une
 *   session de PROFIL (membre ou invité), le hors ligne n'existe pas : rien à
 *   montrer, rien à régler — ce que le compte a gardé reste intact et lui revient.
 * - Ses droits s'appliquent toujours (`keepOffline` d'`account.abilities`) :
 *   un compte à qui le serveur le refuse ne voit rien du hors ligne (les
 *   fichiers restent sur l'appareil ; le droit revenu, tout reparaît).
 * - Plus de connexion pendant un profil → l'appareil revient au compte (aucun
 *   code PIN ne se vérifie sans serveur) ; au retour du réseau, rien n'est
 *   rouvert d'office au nom d'un profil.
 *
 * Pur : les adaptateurs lisent la session, les droits et la connectivité, et
 * appliquent (`offlineOwner.test.ts`).
 */

import { accountTokenIn, accountUserIdIn, profileMarkerIn, type KeyValueStore } from "@tentacle-tv/shared";
import type { ConnectivityState } from "../connectivity/connectivityMachine";

/** L'identité qui possède le hors ligne : le compte de l'appareil, même pendant un profil. */
export interface OfflineOwner {
  userId: string;
  /** Son jeton ; null quand le serveur le tient en réserve (le navigateur, pendant un profil). */
  token: string | null;
}

/** Le propriétaire du hors ligne d'après le stockage de session ; null sans compte connecté. */
export function offlineOwnerOf(store: Pick<KeyValueStore, "getItem">): OfflineOwner | null {
  const userId = accountUserIdIn(store);
  if (!userId) return null;
  return { userId, token: accountTokenIn(store) };
}

/** Une session de profil (un autre membre, un invité) est-elle ouverte sur l'appareil ? */
export function isProfileSessionIn(store: Pick<KeyValueStore, "getItem">): boolean {
  return profileMarkerIn(store).profile !== null;
}

/**
 * Ce que l'on sait du droit `keepOffline` du compte :
 * - `granted` / `refused` : le serveur l'a dit (ou l'a dit la dernière fois — hors ligne, le dernier mot fait foi) ;
 * - `legacy` : serveur d'avant `account.abilities` — le comportement d'avant ;
 * - `unknown` : jamais su (premier lancement hors ligne) — rien de nouveau, le contenu déjà là reste lisible.
 */
export type KeepRight = "granted" | "refused" | "legacy" | "unknown";

/** La forme de `AccountAbilitiesState` (api-client), lue sans en dépendre. */
export type KeepAbilitiesState =
  | { kind: "legacy" }
  | { kind: "pending" }
  | { kind: "known"; abilities: { keepOffline: boolean } };

/** Le droit, d'après ce que le serveur dit maintenant, sinon le dernier mot retenu sur l'appareil. */
export function keepRightOf(state: KeepAbilitiesState, lastKnown: boolean | null): KeepRight {
  if (state.kind === "legacy") return "legacy";
  if (state.kind === "known") return state.abilities.keepOffline ? "granted" : "refused";
  if (lastKnown === null) return "unknown";
  return lastKnown ? "granted" : "refused";
}

export interface OfflineSurfaceInput {
  /** Une session de profil est ouverte. */
  profileSession: boolean;
  keepRight: KeepRight;
  /** Le client et son serveur savent garder un titre (capacités du transfert). */
  engineCanKeep: boolean;
  /** Le compte a au moins un titre gardé sur l'appareil. */
  hasContent: boolean;
}

export interface OfflineSurface {
  /** Montrer QUOI QUE CE SOIT du hors ligne : page, rangées, marqueurs, réglages, suivi. */
  visible: boolean;
  /** Proposer « Garder hors ligne ». */
  canKeep: boolean;
}

const NOTHING: OfflineSurface = { visible: false, canKeep: false };

/** Ce que l'interface montre du hors ligne. */
export function offlineSurfaceOf(input: OfflineSurfaceInput): OfflineSurface {
  if (input.profileSession || input.keepRight === "refused") return NOTHING;
  if (input.keepRight === "unknown") return { visible: input.hasContent, canKeep: false };
  const canKeep = input.engineCanKeep;
  return { visible: canKeep || input.hasContent, canKeep };
}

/**
 * Ce qu'une session de profil devient selon la connectivité :
 * - `none` : rien à faire (session du compte, ou en ligne) ;
 * - `returnToAccount` : plus de connexion → l'appareil revient au compte ;
 * - `cancelManual` : le hors ligne MANUEL est un choix du compte, il n'existe
 *   pas pour un profil (un reste de la session du compte ne l'y enferme pas) ;
 * - `stranded` : plus de connexion, mais le compte ne peut pas revenir sans le
 *   serveur (le navigateur, dont le serveur tient le jeton) — l'attente, sans
 *   rien du hors ligne.
 */
export type OfflineSessionFallback = "none" | "returnToAccount" | "cancelManual" | "stranded";

export interface OfflineSessionFallbackInput {
  profileSession: boolean;
  connectivity: ConnectivityState;
  /** Le jeton du compte est sur l'appareil (bureau, mobile) : il peut revenir sans le serveur. */
  accountRestorable: boolean;
}

export function offlineSessionFallback(input: OfflineSessionFallbackInput): OfflineSessionFallback {
  if (!input.profileSession) return "none";
  if (input.connectivity === "offline-manual") return "cancelManual";
  if (input.connectivity !== "offline-auto") return "none";
  return input.accountRestorable ? "returnToAccount" : "stranded";
}
