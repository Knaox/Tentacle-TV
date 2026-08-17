import type { JellyfinClient } from "@tentacle-tv/api-client";
import type { MediaSource, QualityPreset } from "@tentacle-tv/shared";

/**
 * Politique de débit — version navigateur/desktop : INERTE.
 *
 * Un ordinateur a un écran à portée de main, un vrai clavier et un utilisateur
 * qui peut changer la qualité en deux clics : on ne réduit jamais sa qualité
 * dans son dos. Le téléviseur, lui, substitue ce module au build
 * (`tableSubstitutions.ts` → `lecture/politiqueDebitTv.ts`) : mesure du débit
 * réel et cap automatique quand la connexion ne porte pas le fichier.
 */
export function amorcerMesure(_client: JellyfinClient): void {}

export function capAutomatique(_source: MediaSource | null | undefined): QualityPreset | null {
  return null;
}
