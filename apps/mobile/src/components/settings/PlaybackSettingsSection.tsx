import { useTranslation } from "react-i18next";
import { setPlaybackSettings, useOwnPlaybackSettings } from "@tentacle-tv/api-client";
import {
  PRESET_HINT_KEYS,
  PRESET_LABEL_KEYS,
  SELECTABLE_PRESETS,
  detectPreset,
  presetSettings,
  type PlaybackPreset,
} from "@tentacle-tv/shared";

import { SettingsOptionList, type SettingsOption } from "./SettingsOptionList";
import { SettingsSection } from "./SettingsSection";
import type { SettingsIcon } from "./SettingsRow";

const PRESET_ICONS: Record<PlaybackPreset, SettingsIcon> = {
  default: "check-circle",
  manual: "message-square",
  automatic: "fast-forward",
  custom: "sliders",
};

/**
 * Ce que le lecteur a le droit de faire tout seul, sur téléphone : UN choix,
 * en lignes à coche — chaque mode a besoin de sa phrase pour être compris,
 * qu'un segmenté aurait cachée sous le contrôle.
 *
 * Le réglage fin n'a pas sa place ici : il se fait sur grand écran, il suit
 * le COMPTE, et s'applique donc à cet appareil sans qu'on ait à le répéter.
 * « Personnalisé » n'est pas proposé : c'est ce qu'on lit quand les réglages
 * viennent de l'ordinateur, et le toucher les remplacerait.
 */
export function PlaybackSettingsSection() {
  const { t } = useTranslation("preferences");
  // Les réglages PROPRES : dans un groupe Watch Together, ceux de l'hôte
  // gouvernent la lecture, mais ce sont bien les siens qu'on règle ici.
  const settings = useOwnPlaybackSettings();
  const preset = detectPreset(settings);

  // La liste vient de SELECTABLE_PRESETS, jamais d'un tableau écrit ici :
  // écrite à la main, elle avait déjà manqué l'ajout de « Par défaut ».
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
