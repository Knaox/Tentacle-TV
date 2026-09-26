import { useTranslation } from "react-i18next";

import { MediaPreferencesSection } from "@/components/profile";
import { PlaybackSettingsSection, VideoEngineSection } from "@/components/settings";
import { SettingsScaffold } from "./SettingsScaffold";

/**
 * Sous-écran « Lecture » : ce qui suit le COMPTE d'abord (ce que le lecteur
 * fait tout seul, les langues par bibliothèque), puis ce qui suit
 * l'APPAREIL (le moteur vidéo, la taille et la position des sous-titres).
 * Trois portées, un seul écran — c'est ici qu'on vient pour « ce qui se
 * passe pendant un épisode ».
 */
export function PlaybackScreen() {
  const { t } = useTranslation("profile");
  return (
    <SettingsScaffold title={t("playback")}>
      <PlaybackPane />
    </SettingsScaffold>
  );
}

export function PlaybackPane() {
  return (
    <>
      <PlaybackSettingsSection />
      <MediaPreferencesSection />
      <VideoEngineSection />
    </>
  );
}
