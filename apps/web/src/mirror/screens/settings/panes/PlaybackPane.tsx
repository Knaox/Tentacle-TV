import { LibraryPrefsSection } from "./LibraryPrefsSection";
import { PlaybackModeSection } from "./PlaybackModeSection";

/**
 * `PlaybackPane` de l'app (`screens/settings/PlaybackScreen.tsx`) : ce qui
 * suit le COMPTE — le mode du lecteur, puis les langues par bibliothèque.
 * La section « moteur vidéo » de l'app (lecteur avancé, sous-titres) est
 * propre au lecteur natif : le navigateur n'en a pas.
 */
export function PlaybackPane() {
  return (
    <>
      <PlaybackModeSection />
      <LibraryPrefsSection />
    </>
  );
}
