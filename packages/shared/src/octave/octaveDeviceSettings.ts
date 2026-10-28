/**
 * Octave — les réglages de l'APPAREIL (jamais du compte), leurs clés et leur lecture, PURES : le bureau, le web
 * et le mobile lisent les mêmes valeurs, chacun sur son stockage (`localStorage`, `RNStorageAdapter` préchargé).
 * Un défaut n'est jamais une réécriture : seule une clé ABSENTE prend le défaut, un choix écrit reste le sien.
 *
 * ⚠️ Clés traversées par une chaîne : jamais renommées (le bureau les écrit depuis le 26/10).
 */

/** « Au démarrage, ouvrir » : `last` (défaut, et toute valeur inconnue) · `octave` · `tentacle`. */
export const OCTAVE_STARTUP_KEY = "tentacle_octave_startup";
export const OCTAVE_STARTUP_CHOICES = ["last", "octave", "tentacle"] as const;
export type OctaveStartupChoice = (typeof OCTAVE_STARTUP_CHOICES)[number];
export const DEFAULT_OCTAVE_STARTUP: OctaveStartupChoice = "last";

/** Une valeur lue sur le disque : ce qui n'est pas un choix connu vaut le défaut. */
export function parseOctaveStartup(raw: string | null | undefined): OctaveStartupChoice {
  return (OCTAVE_STARTUP_CHOICES as readonly string[]).includes(raw ?? "") ? (raw as OctaveStartupChoice) : DEFAULT_OCTAVE_STARTUP;
}

/** « Apparence d'Octave » : `same` (comme Tentacle, le défaut) · `light` · `dark`. */
export const OCTAVE_THEME_KEY = "tentacle_octave_theme";
export type OctaveTheme = "same" | "light" | "dark";
const OCTAVE_THEMES: readonly OctaveTheme[] = ["same", "light", "dark"];

export function sanitizeOctaveTheme(raw: string | null | undefined): OctaveTheme {
  return OCTAVE_THEMES.includes(raw as OctaveTheme) ? (raw as OctaveTheme) : "same";
}

/** « Liquid Glass dans Octave » : absent, la valeur de Tentacle (le bureau la recopie une fois). */
export const OCTAVE_LIQUID_GLASS_KEY = "tentacle_octave_liquid_glass";

export function octaveLiquidGlassOf(own: string | null | undefined, tentacle: boolean): boolean {
  return own === null || own === undefined ? tentacle : own === "true";
}

/**
 * « Tenir à jour les playlists gardées sur cet appareil » : ALLUMÉ par défaut (Damien, 26/10 et 28/10) — seul
 * « 0 » le coupe.
 */
export const OCTAVE_AUTOSYNC_KEY = "tentacle_octave_offline_autosync";

export function octaveAutoSyncOn(raw: string | null | undefined): boolean {
  return raw !== "0";
}

/**
 * « Ne pas demander le code PIN au démarrage » (Octave seulement, le MOBILE — Damien, 28/10) : ALLUMÉ par
 * défaut, seul « 0 » le coupe. Allumé, une app rouverte en Octave revient dans l'identité gardée sans « Qui
 * regarde ? » ni code : la règle de la porte est `octaveLaunchSkipsPicker` (`octaveLaunchPin.ts`).
 */
export const OCTAVE_SKIP_LAUNCH_PIN_KEY = "tentacle_octave_skip_launch_pin";

export function octaveSkipLaunchPinOn(raw: string | null | undefined): boolean {
  return raw !== "0";
}
