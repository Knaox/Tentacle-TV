/**
 * Octave — la règle du DÉMARRAGE, pure : dans quel mode l'application
 * s'ouvre. Réglage d'APPAREIL (Réglages › Personnalisation, « Au démarrage,
 * ouvrir »), comme le mode lui-même : « le dernier mode » est forcément propre
 * à l'appareil. Aucune capacité serveur.
 *
 * Trois choix :
 * - `last` (défaut, et toute valeur inconnue) : le mode où l'on était en
 *   quittant — Octave s'il était allumé, Tentacle sinon ;
 * - `octave` : toujours la musique ;
 * - `tentacle` : toujours les films et séries.
 *
 * Octave indisponible (serveur sans `music.library`, compte sans musique) :
 * Tentacle, sans erreur — la décision ne vaut que si Octave peut s'ouvrir.
 */

export const OCTAVE_STARTUP_CHOICES = ["last", "octave", "tentacle"] as const;
export type OctaveStartupChoice = (typeof OCTAVE_STARTUP_CHOICES)[number];
export const DEFAULT_OCTAVE_STARTUP: OctaveStartupChoice = "last";

/** Une valeur lue sur le disque : ce qui n'est pas un choix connu vaut le défaut. */
export function parseOctaveStartup(raw: string | null | undefined): OctaveStartupChoice {
  return (OCTAVE_STARTUP_CHOICES as readonly string[]).includes(raw ?? "") ? (raw as OctaveStartupChoice) : DEFAULT_OCTAVE_STARTUP;
}

/** Le mode VOULU au lancement, avant de savoir si Octave peut s'ouvrir. */
export function startupWantsOctave(choice: OctaveStartupChoice, lastWasOctave: boolean): boolean {
  if (choice === "octave") return true;
  if (choice === "tentacle") return false;
  return lastWasOctave;
}

export interface OctaveAvailabilityState {
  available: boolean;
  /** L'absence est un fait (capacité absente, ou statut reçu). */
  settled: boolean;
}

/**
 * Où arriver sur l'accueil (`/`) : `pending` tant que la disponibilité n'est
 * pas connue (on ne peint RIEN — jamais l'accueil vidéo qui clignote avant
 * Octave), puis `octave` ou `tentacle`.
 */
export type OctaveLanding = "octave" | "tentacle" | "pending";

export function octaveLanding(wantsOctave: boolean, availability: OctaveAvailabilityState): OctaveLanding {
  if (!wantsOctave) return "tentacle";
  if (availability.available) return "octave";
  return availability.settled ? "tentacle" : "pending";
}
