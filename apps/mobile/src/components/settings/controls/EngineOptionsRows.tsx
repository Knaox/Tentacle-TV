import { useState } from "react";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme";
import { setEngineSetting, useEngineSettings } from "@/player/engine/engineSettings";
import { isPlayerSettingShown, type PlayerSettingId, type PlayerSettingsContext } from "@/player/engine/playerSettingsPlatforms";
import type { SettingScope } from "../ScopeBadge";
import { SettingsRow, type SettingsIcon } from "../SettingsRow";
import { SwitchSettingRow } from "./SettingRowKit";

interface SwitchEntry {
  id: Extract<PlayerSettingId, "preferSystemAtmos" | "styledSubtitlesViaMpv" | "matchScreenFrameRate">;
  setting: "preferSystemAtmos" | "styledSubtitlesViaMpv" | "matchFrameRate";
  icon: SettingsIcon;
}

/** Les options du lecteur, dans l'ordre ; leur plateforme vient de la table `PLAYER_SETTINGS`. */
const SWITCHES: readonly SwitchEntry[] = [
  { id: "preferSystemAtmos", setting: "preferSystemAtmos", icon: "speaker" },
  { id: "styledSubtitlesViaMpv", setting: "styledSubtitlesViaMpv", icon: "type" },
  { id: "matchScreenFrameRate", setting: "matchFrameRate", icon: "monitor" },
];

/** Les options que CETTE plateforme a vraiment (pur : la structure s'en sert pour cacher la ligne). */
export function engineOptionsFor(ctx: PlayerSettingsContext): readonly SwitchEntry[] {
  return SWITCHES.filter((entry) => isPlayerSettingShown(entry.id, ctx));
}

interface Props {
  ctx: PlayerSettingsContext;
  scope: SettingScope | null;
  last?: boolean;
}

/**
 * « Options du lecteur » — les cas particuliers du moteur (Atmos du système
 * sur iOS ; sous-titres stylés et fréquence de l'écran sur Android), réglages
 * de CET appareil, REPLIÉS : on n'y touche que si quelque chose se lit mal.
 * Ils ne partent pas sur le bureau : l'ordinateur ne règle pas ce téléphone.
 */
export function EngineOptionsRows({ ctx, scope, last }: Props) {
  const { t } = useTranslation(["settingsMobile", "preferences"]);
  const theme = useTheme();
  const settings = useEngineSettings();
  const [open, setOpen] = useState(false);
  const switches = engineOptionsFor(ctx);
  if (switches.length === 0) return null;
  return (
    <>
      <SettingsRow
        icon="tool"
        label={t("playback.engineOptions")}
        description={open ? t("playback.engineOptionsHint") : undefined}
        last={last && !open}
        onPress={() => setOpen((value) => !value)}
        accessibilityLabel={t("playback.engineOptions")}
        trailing={<Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={theme.colors.text.quaternary} />}
      />
      {open && switches.map((entry, index) => (
        <SwitchSettingRow
          key={entry.id}
          icon={entry.icon}
          label={t(`preferences:${entry.id}`)}
          description={t(`preferences:${entry.id}Hint`)}
          scope={scope}
          value={settings[entry.setting]}
          onChange={(next) => setEngineSetting(entry.setting, next)}
          last={last && index === switches.length - 1}
        />
      ))}
    </>
  );
}
