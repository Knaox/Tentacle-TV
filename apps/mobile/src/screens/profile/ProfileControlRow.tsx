import { useTranslation } from "react-i18next";
import { LanguageChoiceRow } from "@/components/profile/LanguageChoiceRow";
import { LiquidGlassRow, ThemeChoiceRow } from "@/components/settings";
import { AdvancedOnDesktopRow, PhotoRow, SwitchProfileRow, UserNameRow } from "@/components/settings/controls/AccountRows";
import { EngineOptionsRows } from "@/components/settings/controls/EngineOptionsRows";
import { IntrosRow, NextAutoPlayRow, StillWatchingRows, TrendingNowRow } from "@/components/settings/controls/PlaybackAccountRows";
import { DataSaverRow, EngineRow, SubtitlePositionRow, SubtitleSizeRow } from "@/components/settings/controls/PlaybackDeviceRows";
import { playerSettingsContext } from "./playerSettingsContext";
import type { ProfileControlId } from "./profileStructure";
import { CONTROL_SCOPES } from "./settingsScopes";

/**
 * Un réglage SUR PLACE de la structure, rendu par son composant, avec la
 * pastille de sa portée (`CONTROL_SCOPES`, l'inventaire : jamais une portée
 * écrite à la main dans une ligne). Chacun ne monte ses crochets que là où il
 * paraît.
 */
export function ProfileControlRow({ id, last }: { id: ProfileControlId; last: boolean }) {
  const { t } = useTranslation("settingsMobile");
  const scope = CONTROL_SCOPES[id];
  const common = { scope, last };
  switch (id) {
    case "photo": return <PhotoRow {...common} />;
    case "userName": return <UserNameRow {...common} />;
    case "switchProfile": return <SwitchProfileRow {...common} />;
    case "intros": return <IntrosRow {...common} />;
    case "nextAutoPlay": return <NextAutoPlayRow {...common} />;
    case "stillWatching": return <StillWatchingRows {...common} />;
    case "language": return <LanguageChoiceRow last={last} scope={scope ?? undefined} label={t("playback.interfaceLanguage")} />;
    case "trendingNow": return <TrendingNowRow {...common} />;
    case "theme": return <ThemeChoiceRow last={last} scope={scope ?? undefined} />;
    case "liquidGlass": return <LiquidGlassRow last={last} scope={scope ?? undefined} />;
    case "subtitleSize": return <SubtitleSizeRow {...common} />;
    case "subtitlePosition": return <SubtitlePositionRow {...common} />;
    case "dataSaver": return <DataSaverRow {...common} />;
    case "engine": return <EngineRow {...common} />;
    case "engineOptions": return <EngineOptionsRows ctx={playerSettingsContext()} {...common} />;
    case "advancedOnDesktop": return <AdvancedOnDesktopRow {...common} />;
  }
}
