/**
 * Ce que le premier lancement a déjà PROPOSÉ pendant ce lancement de l'app —
 * pour que l'invitation aux avatars et « Action recommandée : posez votre code
 * PIN », qui passent après lui, ne reposent jamais la même question juste
 * derrière (aucun double affichage). En mémoire seulement : au prochain
 * lancement, chacun suit sa règle. Module PUR.
 */

let pin = false;
let photo = false;

export function markFirstRunCovered(step: "pin" | "photo"): void {
  if (step === "pin") pin = true;
  else photo = true;
}

export function firstRunCoveredPin(): boolean {
  return pin;
}

export function firstRunCoveredPhoto(): boolean {
  return photo;
}

/** Tests seulement. */
export function resetFirstRunCovered(): void {
  pin = false;
  photo = false;
}
