/**
 * Octave — le NIVEAU du son qui joue, pour la houle de la page (qui suit
 * l'énergie de la musique). Un filtre `astats` de libavfilter posé dans la
 * chaîne de l'instance audio : il calcule le niveau RMS des échantillons et le
 * pose en métadonnées, SANS les modifier (filtre traversant, format gardé —
 * mesuré : s32 → s32 ; le banc PCM le prouve à l'échantillon près). La page le
 * lit quelques fois par seconde, et seulement quand une houle est à l'écran
 * (`audio_level`) ; la lecture est ASYNCHRONE (`mpv_get_property_async`).
 *
 * Jamais en mode exclusif (sortie « bit pour bit » demandée) : pas de filtre,
 * pas de niveau, la houle garde son allure de toujours.
 */

export const LEVEL_LABEL = "octave-level";

/** `reset=4` : une mesure sur quatre trames (~0,1 à 0,4 s de son), relue par la page. */
export const LEVEL_FILTER = `@${LEVEL_LABEL}:lavfi=[astats=metadata=1:reset=4:measure_perchannel=none:measure_overall=RMS_level]`;

export const LEVEL_PROPERTY = `af-metadata/${LEVEL_LABEL}/lavfi.astats.Overall.RMS_level`;

/** Le plancher rendu pour un silence (`-inf`) : un nombre fini traverse le pont. */
export const SILENCE_DB = -120;

/** La chaîne de filtres de l'instance : le filtre de mesure, sauf en mode exclusif. */
export function levelFilterOption(exclusive: boolean): Record<string, string> {
  return exclusive ? {} : { af: LEVEL_FILTER };
}

/** La valeur lue (« -18.42 », « -inf », absente) → dBFS, ou `null` sans mesure. */
export function parseLevel(raw: string | null): number | null {
  if (raw === null) return null;
  const text = raw.trim().toLowerCase();
  if (text === "-inf") return SILENCE_DB;
  const value = Number(text);
  if (text === "" || !Number.isFinite(value)) return null;
  return Math.min(0, Math.max(SILENCE_DB, value));
}
