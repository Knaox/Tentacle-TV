import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { LanguageChoiceRow, ThemeChoiceRow } from "../../profile/AppearanceRows";
import { AdvancedOnDesktopRow, PhotoRow, SwitchProfileRow, UserNameRow } from "./controls/AccountControls";
import { DataSaverRow, IntrosRow, NextAutoPlayRow, TrendingNowRow } from "./controls/PlaybackControls";
import { StillWatchingRows } from "./controls/StillWatchingRows";
import type { ControlRowProps } from "./controls/SettingRowKit";
import type { WebControlId } from "./webCatalog";

function LanguageRow({ scope, last }: ControlRowProps) {
  const { t } = useTranslation("settingsMobile");
  return <LanguageChoiceRow scope={scope} last={last} label={t("playback.interfaceLanguage")} />;
}

function ThemeRow({ scope, last }: ControlRowProps) {
  return <ThemeChoiceRow scope={scope} last={last} />;
}

/**
 * Le composant web de chaque réglage SUR PLACE du catalogue. Le type
 * `Record<WebControlId, …>` force une entrée pour tout réglage que le web ne
 * déclare pas réservé au mobile (`WEB_UNRENDERED`) : un réglage ajouté au
 * catalogue sans composant web ne compile pas.
 */
export const WEB_CONTROL_RENDERERS: Readonly<Record<WebControlId, ComponentType<ControlRowProps>>> = {
  photo: PhotoRow,
  userName: UserNameRow,
  switchProfile: SwitchProfileRow,
  intros: IntrosRow,
  nextAutoPlay: NextAutoPlayRow,
  stillWatching: StillWatchingRows,
  language: LanguageRow,
  trendingNow: TrendingNowRow,
  theme: ThemeRow,
  dataSaver: DataSaverRow,
  advancedOnDesktop: AdvancedOnDesktopRow,
};
