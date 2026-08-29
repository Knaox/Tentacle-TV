/**
 * Un seuil « avant la fin » : son unité, puis sa valeur.
 *
 * Les deux unités ne se convertissent pas l'une dans l'autre — 98 % vaut
 * vingt-huit secondes sur un animé et quarante sur une série d'une heure,
 * c'est tout l'intérêt du choix. Changer d'unité repart donc d'une valeur
 * usuelle de cette unité-là plutôt que d'une conversion qui n'aurait de sens
 * pour aucun média en particulier.
 *
 * La même paire sert au seuil global et à chaque règle ciblée : une seule
 * forme, un seul comportement.
 */

import { useTranslation } from "react-i18next";
import {
  NEXT_BEFORE_END_PERCENT_MAX,
  NEXT_BEFORE_END_PERCENT_MIN,
  NEXT_BEFORE_END_SECONDS_MAX,
  NEXT_BEFORE_END_SECONDS_MIN,
  type BeforeEndMode,
  type BeforeEndTarget,
} from "@tentacle-tv/shared";
import { SegmentedChoice } from "./SegmentedChoice";

/** La valeur usuelle de chaque unité, posée au changement d'unité. */
const USUAL: Record<BeforeEndMode, number> = { percent: 98, seconds: 30 };

const BOUNDS: Record<BeforeEndMode, [number, number, number]> = {
  percent: [NEXT_BEFORE_END_PERCENT_MIN, NEXT_BEFORE_END_PERCENT_MAX, 1],
  seconds: [NEXT_BEFORE_END_SECONDS_MIN, NEXT_BEFORE_END_SECONDS_MAX, 5],
};

interface BeforeEndTargetFieldsProps {
  idPrefix: string;
  /** Étiquette accessible — le titre du réglage ou de la règle. */
  label: string;
  target: BeforeEndTarget;
  onChange: (target: BeforeEndTarget) => void;
}

export function BeforeEndTargetFields({
  idPrefix, label, target, onChange,
}: BeforeEndTargetFieldsProps) {
  const { t } = useTranslation("preferences");
  const [min, max, step] = BOUNDS[target.mode];

  return (
    <div className="mt-3 space-y-3">
      <SegmentedChoice
        label={`${label} — ${t("beforeEndModeLabel")}`}
        value={target.mode}
        options={[
          { value: "percent", label: t("beforeEndModePercent") },
          { value: "seconds", label: t("beforeEndModeSeconds") },
        ]}
        onChange={(mode: BeforeEndMode) => {
          if (mode !== target.mode) onChange({ mode, value: USUAL[mode] });
        }}
        className="w-full max-w-xs"
      />
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor={`${idPrefix}-value`} className="text-xs text-content-tertiary">
            {t(target.mode === "percent" ? "beforeEndPercentLabel" : "beforeEndSecondsLabel")}
          </label>
          <span className="text-sm font-semibold tabular-nums text-content-secondary">
            {t(target.mode === "percent" ? "beforeEndPercentValue" : "beforeEndSecondsValue", {
              value: target.value,
            })}
          </span>
        </div>
        <input
          id={`${idPrefix}-value`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={target.value}
          onChange={(e) => { onChange({ mode: target.mode, value: Number(e.target.value) }); }}
          className="mt-2 h-6 w-full max-w-xs cursor-pointer accent-brand"
        />
      </div>
    </div>
  );
}
