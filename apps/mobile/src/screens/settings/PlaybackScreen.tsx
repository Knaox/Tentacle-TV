import { useTranslation } from "react-i18next";

import { MediaPreferencesSection } from "@/components/profile";
import { PlaybackSettingsSection } from "@/components/settings";
import { SettingsScaffold } from "./SettingsScaffold";

/**
 * Sous-écran « Lecture » : ce que le lecteur fait tout seul (passages d'un
 * épisode, enchaînement), puis les préférences audio / sous-titres par
 * bibliothèque.
 *
 * Les premiers suivent le COMPTE, les secondes la bibliothèque : deux portées
 * différentes, un seul écran — c'est ici qu'on vient pour « ce qui se passe
 * pendant un épisode ».
 */
export function PlaybackScreen() {
  const { t } = useTranslation("profile");
  return (
    <SettingsScaffold title={t("playback")}>
      <PlaybackSettingsSection />
      <MediaPreferencesSection />
    </SettingsScaffold>
  );
}
