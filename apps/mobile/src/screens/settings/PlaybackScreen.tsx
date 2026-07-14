import { useTranslation } from "react-i18next";

import { MediaPreferencesSection } from "@/components/profile";
import { SettingsScaffold } from "./SettingsScaffold";

/**
 * Sous-écran « Lecture » : préférences audio / sous-titres par bibliothèque
 * (MediaPreferencesSection, déplacée hors du hub profil).
 */
export function PlaybackScreen() {
  const { t } = useTranslation("profile");
  return (
    <SettingsScaffold title={t("playback")}>
      <MediaPreferencesSection />
    </SettingsScaffold>
  );
}
