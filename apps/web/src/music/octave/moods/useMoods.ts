/**
 * Octave — les ambiances de l'extension et la playlist d'une ambiance. Les crochets vivent dans api-client
 * (`useMusicMoods`, `useMusicMoodMix`, `useMusicMoodTracks`, lus aussi par le mobile) ; ici, l'extension de ce
 * serveur et la langue de l'interface.
 */

import { useTranslation } from "react-i18next";
import { useMusicMoodMix, useMusicMoods, useMusicMoodTracks } from "@tentacle-tv/api-client";
import type { ExternalMusicMood } from "@tentacle-tv/shared/music";
import { useOctaveProvider } from "../mode/useOctaveProvider";

/** Les ambiances ; `[]` sans extension qui les sert (ni requête ni attente). */
export function useMoods(): { moods: ExternalMusicMood[]; pending: boolean } {
  const { i18n } = useTranslation();
  return useMusicMoods(useOctaveProvider(), i18n.language);
}

/** La playlist d'une ambiance (vue). */
export function useMoodMix(moodId: string) {
  const { i18n } = useTranslation();
  return useMusicMoodMix(useOctaveProvider(), moodId, i18n.language);
}

/** Les titres d'une ambiance À LA DEMANDE (bouton Lecture d'une carte), sous la MÊME clé que sa vue. */
export function useMoodTracks() {
  const { i18n } = useTranslation();
  return useMusicMoodTracks(useOctaveProvider(), i18n.language);
}
