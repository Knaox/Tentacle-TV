import { FAMILY_PIN_LENGTH, isValidPin } from "@tentacle-tv/shared";

/**
 * La saisie d'un code PIN, réduite à ses chiffres : quatre au plus (un collage
 * « 12 34 » passe). Module pur, testé ; le serveur reste seul juge du code
 * (il le hache et le vérifie), rien n'en est gardé sur l'appareil.
 */
export function pinDigits(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(0, FAMILY_PIN_LENGTH);
}

export type PinEntryProblem = "format" | "mismatch" | null;

/** Deux saisies identiques de quatre chiffres, ou ce qui manque. */
export function pinEntryProblem(pin: string, confirm: string): PinEntryProblem {
  if (!isValidPin(pin)) return "format";
  if (pin !== confirm) return "mismatch";
  return null;
}
