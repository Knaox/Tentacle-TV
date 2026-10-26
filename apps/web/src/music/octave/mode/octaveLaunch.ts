/**
 * Octave — la règle du LANCEMENT en Octave, pure (`octaveLaunch.test.ts`) :
 * ce que l'application décide AVANT sa première image quand elle s'ouvre sur
 * la musique. Le mode voulu vient d'`octaveStartup.ts` (« Au démarrage,
 * ouvrir ») ; ici, ce qu'il entraîne :
 *
 * - **lancer en Octave** : le mode voulu, un compte connecté, et Octave pas
 *   déjà connu INDISPONIBLE pour ce compte sur cet appareil (le miroir). Un
 *   miroir absent (premier lancement depuis la mise à jour) vaut « disponible » :
 *   la réponse du serveur tranche ensuite, et sans musique on retombe sur
 *   Tentacle, comme avant ;
 * - **la disponibilité au lancement** : la réponse du serveur dès qu'elle est
 *   là, sinon le miroir — Octave se peint sans attendre deux allers-retours ;
 * - **« Qui regarde ? »** : jamais sur un lancement en Octave. L'identité est
 *   celle que l'appareil garde (la dernière utilisée), et elle se rouvre SANS
 *   son code PIN : « c'est un lecteur de musique » (Damien, 26/10) — rouvrir
 *   Octave avec le même profil n'est pas en changer, l'appareil en a déjà le
 *   jeton. Le code ne se demande (petite feuille, D7) que si l'identité
 *   CHANGE : la session d'un profil a pris fin (`requested`) et l'on retombe
 *   sur le compte. Seule la SÉCURITÉ ramène le sélecteur : le serveur dit
 *   l'appareil dans un profil dont l'application n'a pas le jeton — ouvrir le
 *   compte sans son code serait un contournement.
 */

import { pickerLaunch, sameUserId, type PickerProfilesDto, type PickerStay } from "@tentacle-tv/shared";
import type { OctaveAvailabilityState } from "./octaveStartup";

/** La dernière disponibilité d'Octave connue, par serveur ET par compte (aucun secret). */
export interface OctaveLaunchMirror {
  /** `<serveur>|<compte>` — l'identité de la session gardée (profil compris). */
  owner: string;
  available: boolean;
}

/** Le lancement se fait-il dans Octave ? (`owner` : null sans session.) */
export function launchesInOctave(wantsOctave: boolean, owner: string | null, mirror: OctaveLaunchMirror | null): boolean {
  if (!wantsOctave || owner === null) return false;
  return !(mirror?.owner === owner && !mirror.available);
}

/**
 * La disponibilité qui décide de la page d'arrivée : celle du serveur dès
 * qu'elle est établie ; avant, le miroir si Octave y était disponible pour
 * ce compte (la réponse du serveur corrige ensuite, sans erreur).
 */
export function launchAvailability(fresh: OctaveAvailabilityState, owner: string | null, mirror: OctaveLaunchMirror | null): OctaveAvailabilityState {
  if (fresh.settled) return fresh;
  if (owner !== null && mirror?.owner === owner && mirror.available) return { available: true, settled: true };
  return fresh;
}

/** Ce que devient « Qui regarde ? » sur un lancement en Octave. */
export type OctaveGateOutcome =
  /** L'identité gardée s'ouvre, sans rien demander. */
  | { kind: "open" }
  /** Son code PIN d'abord, dans la petite feuille d'Octave. */
  | { kind: "pin"; profileId: string }
  /** La sécurité l'exige : le sélecteur, comme hors d'Octave. */
  | { kind: "picker" };

type GateListing = Pick<PickerProfilesDto, "profiles" | "currentProfileId" | "account" | "atLaunch" | "pickerRequired">;

/**
 * À appeler quand la règle ordinaire (`launchDecision.ts`) dirait
 * « sélecteur » : sur un lancement en Octave, l'identité gardée
 * (`heldProfileId`, null : le compte lui-même) se rouvre telle quelle, sans
 * code. `requested` (la session d'un profil a pris fin : l'identité n'est plus
 * celle d'avant) remet le code de celle sur qui l'on retombe, s'il en a un. La
 * préférence de l'appareil retenu (`stay`) a déjà été appliquée par la règle
 * ordinaire : un profil qu'elle dispensait n'arrive jamais ici.
 */
export function octaveGateOutcome(
  listing: GateListing,
  heldProfileId: string | null,
  stay: PickerStay | null,
  now: number,
  requested = false,
): OctaveGateOutcome {
  const held = heldProfileId === null ? null : { profileId: heldProfileId };
  // La règle SANS la préférence : ce qui reste est la sécurité.
  if (pickerLaunch({ ...listing, atLaunch: false }, held, stay, now) === "picker") return { kind: "picker" };
  const identity = heldProfileId ?? listing.account.userId;
  const profile = listing.profiles.find((candidate) => sameUserId(candidate.userId, identity));
  if (!profile) return { kind: "picker" };
  return requested && profile.hasPin ? { kind: "pin", profileId: profile.userId } : { kind: "open" };
}

/** Ce que la porte de « Qui regarde ? » fait d'une phase, sur un lancement en Octave. */
export interface OctaveGateStep<P extends string> {
  phase: P | "app";
  /** Le profil dont la petite feuille demande le code ; null : pas de feuille. */
  pinProfile: PickerProfilesDto["profiles"][number] | null;
  /** L'identité est ouverte : la porte ne revérifie plus que la sécurité. */
  opened: boolean;
}

/**
 * L'adaptateur de la porte : hors d'un lancement en Octave, ou pour une autre
 * phase que le sélecteur, rien ne change ; sinon `octaveGateOutcome`.
 */
export function octaveGateStep<P extends string>(
  phase: P,
  listing: PickerProfilesDto | null,
  heldProfileId: string | null,
  stay: PickerStay | null,
  now: number,
  inOctave: boolean,
  requested = false,
): OctaveGateStep<P> {
  const unchanged = { phase, pinProfile: null, opened: false };
  if (!inOctave || phase !== "picker" || !listing) return unchanged;
  const outcome = octaveGateOutcome(listing, heldProfileId, stay, now, requested);
  if (outcome.kind === "open") return { phase: "app", pinProfile: null, opened: true };
  if (outcome.kind === "picker") return unchanged;
  const profile = listing.profiles.find((candidate) => candidate.userId === outcome.profileId) ?? null;
  return profile ? { phase, pinProfile: profile, opened: false } : unchanged;
}
