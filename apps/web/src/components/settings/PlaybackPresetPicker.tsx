/**
 * Le choix qui suffit à la plupart : le réglage livré, le lecteur qui PROPOSE,
 * ou le lecteur qui FAIT.
 *
 * Il est en tête des réglages de lecture parce que c'est la seule question que
 * la plupart des gens se posent. Le détail — quel passage, quel délai, quel
 * déclencheur — vit derrière un repli, et n'est utile qu'à qui le cherche.
 *
 * « Personnalisé » n'est pas un bouton : c'est ce qu'on lit quand les réglages
 * ne correspondent à aucun mode. On ne peut donc pas le choisir — on y tombe en
 * touchant un réglage fin, et l'étiquette le dit.
 *
 * ⚠️ La liste des modes vient de `SELECTABLE_PRESETS`, jamais d'un tableau
 * écrit ici. Écrite à la main, elle avait déjà manqué l'ajout de « Par
 * défaut » : un compte neuf tombait alors sur un mode qu'aucun bouton ne
 * portait — donc aucune option cochée, sous une aide qui lui annonçait des
 * réglages « personnalisés ».
 */

import { useTranslation } from "react-i18next";
import { setPlaybackSettings } from "@tentacle-tv/api-client";
import {
  PRESET_HINT_KEYS,
  PRESET_LABEL_KEYS,
  SELECTABLE_PRESETS,
  detectPreset,
  presetSettings,
  type PlaybackPreset,
  type PlaybackSettings,
} from "@tentacle-tv/shared";
import { SegmentedChoice } from "./SegmentedChoice";

interface PlaybackPresetPickerProps {
  settings: PlaybackSettings;
}

export function PlaybackPresetPicker({ settings }: PlaybackPresetPickerProps) {
  const { t } = useTranslation("preferences");
  const preset = detectPreset(settings);

  const options: { value: PlaybackPreset; label: string }[] = [
    ...SELECTABLE_PRESETS.map((value) => ({ value, label: t(PRESET_LABEL_KEYS[value]) })),
    // « Personnalisé » n'apparaît que lorsqu'on y est : proposer un mode qui ne
    // décrit rien reviendrait à offrir un bouton sans effet.
    ...(preset === "custom" ? [{ value: "custom" as const, label: t(PRESET_LABEL_KEYS.custom) }] : []),
  ];

  return (
    <div>
      <SegmentedChoice
        label={t("playbackModeLabel")}
        value={preset}
        options={options}
        onChange={(value) => {
          if (value === "custom") return; // un constat, pas un choix
          setPlaybackSettings(presetSettings(value));
        }}
        className="w-full"
      />
      <p className="mt-3 text-xs leading-relaxed text-content-tertiary">
        {t(PRESET_HINT_KEYS[preset])}
      </p>
    </div>
  );
}
