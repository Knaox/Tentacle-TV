import { useTranslation } from "react-i18next";
import { CircleCheck, FastForward, MessageSquare, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { setPlaybackSettings, useOwnPlaybackSettings } from "@tentacle-tv/api-client";
import {
  PRESET_HINT_KEYS,
  PRESET_LABEL_KEYS,
  SELECTABLE_PRESETS,
  detectPreset,
  presetSettings,
  type PlaybackPreset,
} from "@tentacle-tv/shared";
import { SettingsOptionList, type SettingsOption } from "../ui/SettingsOptionList";
import { SettingsSection } from "../ui/SettingsSection";

const PRESET_ICONS: Record<PlaybackPreset, LucideIcon> = {
  default: CircleCheck,
  manual: MessageSquare,
  automatic: FastForward,
  custom: SlidersHorizontal,
};

/**
 * `PlaybackSettingsSection` de l'app : ce que le lecteur a le droit de faire
 * tout seul, UN choix en lignes à coche (chaque mode a sa phrase). Le réglage
 * fin reste au bureau ; « Personnalisé » n'apparaît que lorsqu'on y est. La
 * logique est celle de `PlaybackPresetPicker` du web (presets partagés).
 */
export function PlaybackModeSection() {
  const { t } = useTranslation("preferences");
  // Les réglages PROPRES (dans un groupe Watch Together, l'hôte gouverne la lecture).
  const settings = useOwnPlaybackSettings();
  const preset = detectPreset(settings);
  const shown: PlaybackPreset[] = [...SELECTABLE_PRESETS, ...(preset === "custom" ? ["custom" as const] : [])];
  const options: SettingsOption<PlaybackPreset>[] = shown.map((value) => ({
    value,
    label: t(PRESET_LABEL_KEYS[value]),
    description: t(PRESET_HINT_KEYS[value]),
    icon: PRESET_ICONS[value],
  }));

  return (
    <SettingsSection
      title={t("playbackModeTitle")}
      caption={`${t("playbackSettingsAccount")} ${t("playbackAdvancedOnDesktop")}`}
    >
      <SettingsOptionList
        options={options}
        value={preset}
        onChange={(value) => {
          const chosen = SELECTABLE_PRESETS.find((entry) => entry === value);
          if (chosen) setPlaybackSettings(presetSettings(chosen));
        }}
      />
    </SettingsSection>
  );
}
