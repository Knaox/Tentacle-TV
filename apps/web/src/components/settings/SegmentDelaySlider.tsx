/**
 * Le délai avant un saut automatique — en SECONDES, au curseur.
 *
 * Il s'affichait en millisecondes brutes, dans un champ nombre : « 3000 ».
 * C'est l'unité du moteur, pas celle d'un spectateur, et un champ nombre nu ne
 * dit ni le minimum, ni le maximum, ni ce qu'une valeur raisonnable vaut. Le
 * curseur dit les trois d'un coup.
 *
 * Le STOCKAGE reste en millisecondes : c'est la seule unité où l'on puisse
 * demander une seconde et demie, et les cadences des lecteurs vont de 1 à 8 Hz.
 * Seul l'affichage change.
 */

import { useTranslation } from "react-i18next";
import { rangeFill } from "../../lib/rangeFill";

/** Au-delà, ce n'est plus un délai avant un saut, c'est une hésitation. */
const MAX_SECONDS = 15;
const STEP_SECONDS = 0.5;

interface SegmentDelaySliderProps {
  id: string;
  valueMs: number;
  onChange: (valueMs: number) => void;
}

export function SegmentDelaySlider({ id, valueMs, onChange }: SegmentDelaySliderProps) {
  const { t } = useTranslation("preferences");
  const seconds = Math.min(MAX_SECONDS, Math.max(0, valueMs / 1000));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium text-content-primary">
          {t("segmentDelayLabel")}
        </label>
        <span className="text-sm font-semibold tabular-nums text-content-secondary">
          {seconds === 0 ? t("segmentDelayImmediate") : t("segmentDelayValue", { seconds })}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{t("segmentDelayHint")}</p>
      <input
        id={id}
        type="range"
        min={0}
        max={MAX_SECONDS}
        step={STEP_SECONDS}
        value={seconds}
        onChange={(e) => { onChange(Math.round(Number(e.target.value) * 1000)); }}
        style={rangeFill(seconds, 0, MAX_SECONDS)}
        className="ctl-range mt-3 w-full max-w-xs"
      />
    </div>
  );
}
