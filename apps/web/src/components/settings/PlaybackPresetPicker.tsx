/**
 * Le choix qui suffit à la plupart : le réglage livré, le lecteur qui PROPOSE,
 * ou le lecteur qui FAIT.
 *
 * Il est en tête des réglages de lecture parce que c'est la seule question que
 * la plupart des gens se posent. Chaque mode est une TUILE (refonte de nov.
 * 2026) : son nom, la phrase qui dit ce qu'il fait, et son schéma — on choisit
 * en voyant ce qui se passera, sans lire trois explications l'une après
 * l'autre. Le détail — quel passage, quel délai, quel déclencheur — vit sous
 * « Avancé », et n'est utile qu'à qui le cherche.
 *
 * « Personnalisé » n'est pas un choix : c'est ce qu'on lit quand les réglages
 * ne correspondent à aucun mode. On ne peut donc pas le choisir — on y tombe en
 * touchant un réglage fin, et sa tuile le dit.
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
import { PlaybackModeMini } from "./PlaybackModeMini";

interface PlaybackPresetPickerProps {
  settings: PlaybackSettings;
}

export function PlaybackPresetPicker({ settings }: PlaybackPresetPickerProps) {
  const { t } = useTranslation(["preferences", "player"]);
  const preset = detectPreset(settings);

  // « Personnalisé » n'apparaît que lorsqu'on y est : proposer un mode qui ne
  // décrit rien reviendrait à offrir un bouton sans effet.
  const presets: readonly PlaybackPreset[] = preset === "custom" ? [...SELECTABLE_PRESETS, "custom"] : SELECTABLE_PRESETS;

  return (
    <div
      role="radiogroup"
      aria-label={t("preferences:playbackModeLabel")}
      className={`grid gap-2.5 ${presets.length === 4 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
    >
      {presets.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={value === preset}
          onClick={() => {
            if (value === "custom") return; // un constat, pas un choix
            setPlaybackSettings(presetSettings(value));
          }}
          className="ui-tile flex min-w-0 flex-col gap-1 p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <span className="text-[15px] font-semibold leading-snug text-content-primary">{t(`preferences:${PRESET_LABEL_KEYS[value]}`)}</span>
          <span className="grow text-[13px] leading-relaxed text-content-secondary">{t(`preferences:${PRESET_HINT_KEYS[value]}`)}</span>
          <PlaybackModeMini preset={value} skipLabel={t("player:skipIntro")} />
        </button>
      ))}
    </div>
  );
}
