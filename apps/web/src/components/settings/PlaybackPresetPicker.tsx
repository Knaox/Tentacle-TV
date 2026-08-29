/**
 * Le choix qui suffit à la plupart : le lecteur PROPOSE, ou le lecteur FAIT.
 *
 * Il est en tête des réglages de lecture parce que c'est la seule question que
 * la plupart des gens se posent. Le détail — quel passage, quel délai, quel
 * déclencheur — vit derrière un repli, et n'est utile qu'à qui le cherche.
 *
 * « Personnalisé » n'est pas un bouton : c'est ce qu'on lit quand les réglages
 * ne correspondent à aucun des deux modes. On ne peut donc pas le choisir — on
 * y tombe en touchant un réglage fin, et l'étiquette le dit.
 */

import { useTranslation } from "react-i18next";
import { setPlaybackSettings } from "@tentacle-tv/api-client";
import { detectPreset, presetSettings, type PlaybackSettings } from "@tentacle-tv/shared";
import { SegmentedChoice } from "./SegmentedChoice";

interface PlaybackPresetPickerProps {
  settings: PlaybackSettings;
}

export function PlaybackPresetPicker({ settings }: PlaybackPresetPickerProps) {
  const { t } = useTranslation("preferences");
  const preset = detectPreset(settings);

  return (
    <div>
      <SegmentedChoice
        label={t("playbackModeLabel")}
        value={preset}
        options={[
          { value: "manual", label: t("playbackModeManual") },
          { value: "automatic", label: t("playbackModeAutomatic") },
          ...(preset === "custom" ? [{ value: "custom" as const, label: t("playbackModeCustom") }] : []),
        ]}
        onChange={(value) => {
          if (value === "custom") return; // un constat, pas un choix
          setPlaybackSettings(presetSettings(value));
        }}
        className="w-full max-w-md"
      />
      <p className="mt-3 text-xs leading-relaxed text-content-tertiary">
        {t(
          preset === "manual"
            ? "playbackModeManualHint"
            : preset === "automatic"
              ? "playbackModeAutomaticHint"
              : "playbackModeCustomHint",
        )}
      </p>
    </div>
  );
}
