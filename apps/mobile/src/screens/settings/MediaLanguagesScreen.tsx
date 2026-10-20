import { useTranslation } from "react-i18next";
import { MediaPreferencesSection } from "@/components/profile";
import { SettingsScaffold } from "./SettingsScaffold";

/**
 * « Langues audio et sous-titres » — une ligne par bibliothèque, réglage du
 * COMPTE (préférences par bibliothèque du serveur, file locale hors ligne).
 * Le VOLET est le contenu seul : l'écran l'habille de son en-tête sur
 * téléphone, la tablette le pose dans sa colonne de détail.
 */
export function MediaLanguagesScreen() {
  const { t } = useTranslation("settingsMobile");
  return (
    <SettingsScaffold title={t("playback.mediaLanguages")}>
      <MediaLanguagesPane />
    </SettingsScaffold>
  );
}

export function MediaLanguagesPane() {
  return <MediaPreferencesSection />;
}
