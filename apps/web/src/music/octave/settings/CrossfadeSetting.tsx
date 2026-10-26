/**
 * Octave — « Transition douce » dans les Réglages d'Octave : l'interrupteur, puis la durée du fondu (2 à 12 s)
 * quand il est allumé. Un réglage de l'appareil (`engine/crossfadeSetting.ts`), appliqué au moteur aussitôt,
 * même pendant l'écoute ; aucune capacité serveur.
 */

import type { ReactNode } from "react";
import { SettingsSection } from "@tentacle-tv/ui";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../../../components/settings/ToggleSwitch";
import { rangeFill } from "../../../lib/rangeFill";
import { CROSSFADE_DEFAULT_S, CROSSFADE_MAX_S, CROSSFADE_MIN_S } from "../../engine/crossfadeRules";
import { setCrossfadeMs, useCrossfadeMs } from "../../engine/crossfadeSetting";

/** `badge` : la pastille de portée, à côté du titre du groupe. */
export function CrossfadeSetting({ badge }: { badge?: ReactNode } = {}) {
  const { t } = useTranslation("octaveShell");
  const ms = useCrossfadeMs();
  const on = ms > 0;
  const seconds = ms / 1000;
  return (
    <SettingsSection title={t("crossfade.section")} caption={t("crossfade.caption")} badge={badge}>
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-content-primary">{t("crossfade.label")}</p>
          <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{t("crossfade.hint")}</p>
        </div>
        <ToggleSwitch checked={on} onChange={(next) => setCrossfadeMs(next ? CROSSFADE_DEFAULT_S * 1000 : 0)} label={t("crossfade.label")} />
      </div>
      {on && (
        <div className="px-5 pb-5" data-crossfade-duration>
          <div className="flex items-baseline justify-between gap-4">
            <label htmlFor="octave-crossfade" className="text-sm font-medium text-content-primary">{t("crossfade.duration")}</label>
            <span className="text-sm font-semibold tabular-nums text-content-secondary">{t("crossfade.seconds", { count: seconds })}</span>
          </div>
          <input
            id="octave-crossfade"
            type="range"
            min={CROSSFADE_MIN_S}
            max={CROSSFADE_MAX_S}
            step={1}
            value={seconds}
            onChange={(e) => setCrossfadeMs(Number(e.target.value) * 1000)}
            style={rangeFill(seconds, CROSSFADE_MIN_S, CROSSFADE_MAX_S)}
            className="ctl-range mt-3 w-full max-w-xs"
          />
        </div>
      )}
    </SettingsSection>
  );
}
