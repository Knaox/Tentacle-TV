import { FAMILY_PIN_LENGTH } from "@tentacle-tv/shared";
import type { ProfileRefusal } from "./profileRefusal";

/**
 * Le PAVÉ DU CODE PIN d'un téléviseur — quatre chiffres saisis à la
 * télécommande. Module pur, horloge injectée. La TV ne compare RIEN : le
 * quatrième chiffre part au serveur (`submit`), qui seul dit juste, faux
 * (essais restants) ou bloqué (jusqu'à quand) ; le code ne vit que le temps
 * de cet appel, jamais sur le disque.
 *
 * - `typing` : on tape ; ⌫ efface le dernier chiffre ;
 * - `checking` : le code est parti, le pavé ne prend plus rien ;
 * - `wrong` : refusé — les points se vident, le prochain chiffre recommence ;
 * - `locked` : trop d'essais, le pavé se tait jusqu'à `lockedUntil`.
 */

/** Les touches, dans l'ordre du pavé : une rangée, comme le code de l'Apple TV. */
export const PIN_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;
export type PinDigit = (typeof PIN_DIGITS)[number];

export type PinPhase = "typing" | "checking" | "wrong" | "locked";

export interface PinEntry {
  digits: string;
  phase: PinPhase;
  /** Après un refus : les essais restants avant blocage. */
  attemptsLeft: number | null;
  /** Bloqué jusqu'à (ISO). */
  lockedUntil: string | null;
}

export const PIN_ENTRY_START: PinEntry = { digits: "", phase: "typing", attemptsLeft: null, lockedUntil: null };

function lockedAfter(until: string | null, now: number): boolean {
  if (!until) return false;
  const at = Date.parse(until);
  return Number.isFinite(at) && at > now;
}

/** Le pavé d'un profil : bloqué d'emblée si le serveur l'a dit. */
export function pinEntryFor(lockedUntil: string | null, now: number): PinEntry {
  return lockedAfter(lockedUntil, now) ? { ...PIN_ENTRY_START, phase: "locked", lockedUntil } : PIN_ENTRY_START;
}

/** Un chiffre : le quatrième envoie le code (`submit`), une fois. */
export function pressPinDigit(entry: PinEntry, digit: PinDigit): { entry: PinEntry; submit: string | null } {
  if (entry.phase === "checking" || entry.phase === "locked") return { entry, submit: null };
  const digits = (entry.phase === "wrong" ? "" : entry.digits) + digit;
  if (digits.length >= FAMILY_PIN_LENGTH) {
    const code = digits.slice(0, FAMILY_PIN_LENGTH);
    return { entry: { ...entry, digits: code, phase: "checking" }, submit: code };
  }
  return { entry: { ...entry, digits, phase: "typing" }, submit: null };
}

/** ⌫ : le dernier chiffre (après un refus, il n'y a plus rien à effacer). */
export function erasePinDigit(entry: PinEntry): PinEntry {
  if (entry.phase === "checking" || entry.phase === "locked") return entry;
  if (entry.phase === "wrong") return { ...entry, digits: "", phase: "typing" };
  return { ...entry, digits: entry.digits.slice(0, -1) };
}

/** Le serveur a refusé le code. Tout autre refus vide le pavé : l'écran dit le reste. */
export function pinRefused(entry: PinEntry, refusal: ProfileRefusal): PinEntry {
  if (refusal.kind === "pinInvalid") return { ...entry, digits: "", phase: "wrong", attemptsLeft: refusal.attemptsLeft };
  if (refusal.kind === "locked") return { ...entry, digits: "", phase: "locked", lockedUntil: refusal.until };
  return { ...entry, digits: "", phase: "typing" };
}

/** Un blocage échu rouvre le pavé ; `null` : rien ne change. */
export function pinLockLapsed(entry: PinEntry, now: number): PinEntry | null {
  if (entry.phase !== "locked" || lockedAfter(entry.lockedUntil, now)) return null;
  return { ...PIN_ENTRY_START };
}

/** Le temps avant la fin du blocage (ms), pour réveiller le pavé ; null hors blocage. */
export function pinLockRemainingMs(entry: PinEntry, now: number): number | null {
  if (entry.phase !== "locked" || !entry.lockedUntil) return null;
  const at = Date.parse(entry.lockedUntil);
  return Number.isFinite(at) ? Math.max(0, at - now) : null;
}
