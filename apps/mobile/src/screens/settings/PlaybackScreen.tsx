import { Platform } from "react-native";
import { useTranslation } from "react-i18next";

import { MediaPreferencesSection } from "@/components/profile";
import { PlaybackSettingsSection, VideoEngineSection } from "@/components/settings";
import { isPlayerSettingShown, type PlayerSettingsContext } from "@/player/engine/playerSettingsPlatforms";
import { isMpvAvailable } from "../../../modules/mpv-player";
import { SettingsScaffold } from "./SettingsScaffold";

/** Le seul endroit où l'écran lit la plateforme : la table décide du reste. */
const settingsContext = (): PlayerSettingsContext => ({
  platform: Platform.OS === "android" ? "android" : "ios",
  advancedEngine: isMpvAvailable(),
});

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
    <SettingsScaffold title={t("player")}>
      <PlaybackPane />
    </SettingsScaffold>
  );
}

export function PlaybackPane() {
  const ctx = settingsContext();
  return (
    <>
      {isPlayerSettingShown("playbackMode", ctx) && <PlaybackSettingsSection />}
      {isPlayerSettingShown("mediaLanguages", ctx) && <MediaPreferencesSection />}
      <VideoEngineSection ctx={ctx} />
    </>
  );
}
