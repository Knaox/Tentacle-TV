import type { ScrubCountdownPolicy } from "@tentacle-tv/tv-core";

/**
 * La politique du décompte du défilement sur ANDROID TV (la variante Apple
 * TV : `scrubCountdownPolicy.ios.ts`) : aucune — le réglage « Avance rapide »
 * n'existe pas ici, et le lecteur garde la politique d'avant
 * (`RESUME_COUNTDOWN_POLICY` : la lecture repart à la cible au bout de 5 s).
 */
export function useScrubCountdownPolicy(): ScrubCountdownPolicy | undefined {
  return undefined;
}
