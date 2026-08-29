/**
 * La durée du compte à rebours « épisode suivant » — en secondes, au curseur.
 *
 * Elle était figée à dix secondes dans le moteur. C'est le pendant exact du
 * délai d'un saut (`SegmentDelaySlider`) : même unité de stockage — la
 * milliseconde, la seule où l'on puisse demander une seconde et demie — et même
 * affichage en secondes.
 *
 * Le texte d'aide dit ce que le réglage ne peut PAS faire, et c'est le plus
 * important : ce n'est qu'un plafond. Une fiche qui paraît quatre secondes
 * avant la fin ne décompte pas dix secondes, quoi qu'on règle ici — le moteur
 * la cale sur ce qui reste (`autoNextEngine.ts`).
 */

import { useTranslation } from "react-i18next";
import { NEXT_COUNTDOWN_MAX_MS, NEXT_COUNTDOWN_MIN_MS } from "@tentacle-tv/shared";
import { rangeFill } from "../../lib/rangeFill";

const MIN_SECONDS = NEXT_COUNTDOWN_MIN_MS / 1000;
const MAX_SECONDS = NEXT_COUNTDOWN_MAX_MS / 1000;
const STEP_SECONDS = 0.5;

interface NextCountdownSliderProps {
  valueMs: number;
  onChange: (valueMs: number) => void;
  /** Sans le compte à rebours, ce curseur n'a rien à mesurer. */
  disabled?: boolean;
}

export function NextCountdownSlider({ valueMs, onChange, disabled = false }: NextCountdownSliderProps) {
  const { t } = useTranslation("preferences");
  const seconds = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, valueMs / 1000));

  return (
    <div className={disabled ? "opacity-50" : undefined}>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor="next-countdown" className="text-sm font-medium text-content-primary">
          {t("nextCountdownLabel")}
        </label>
        <span className="text-sm font-semibold tabular-nums text-content-secondary">
          {t("segmentDelayValue", { seconds })}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
        {disabled ? t("upNextNeedsCountdown") : t("nextCountdownHint")}
      </p>
      <input
        id="next-countdown"
        type="range"
        min={MIN_SECONDS}
        max={MAX_SECONDS}
        step={STEP_SECONDS}
        value={seconds}
        disabled={disabled}
        onChange={(e) => { onChange(Math.round(Number(e.target.value) * 1000)); }}
        style={rangeFill(seconds, MIN_SECONDS, MAX_SECONDS)}
        className="ctl-range mt-3 w-full max-w-xs"
      />
    </div>
  );
}
