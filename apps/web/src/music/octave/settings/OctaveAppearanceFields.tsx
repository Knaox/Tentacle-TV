/**
 * Octave — les champs de l'apparence d'Octave (une seule source, deux écrans : la page « Réglages d'Octave » DANS
 * Octave, et le groupe « Octave » de Réglages › Apparence de Tentacle) : le thème (Comme Tentacle · Clair · Sombre)
 * et « Liquid Glass dans Octave » — seulement là où le verre natif existe (macOS 26), jamais au web. Les valeurs
 * vivent dans `theme/octaveAppearance.ts` (réglages de l'appareil).
 */

import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { SettingsRow } from "@tentacle-tv/ui";
import { SegmentedChoice } from "../../../components/settings/SegmentedChoice";
import { ToggleSwitch } from "../../../components/settings/ToggleSwitch";
import {
  getOctaveLiquidGlass,
  getOctaveTheme,
  setOctaveLiquidGlass,
  setOctaveTheme,
  subscribeOctaveAppearance,
  type OctaveTheme,
} from "../../../theme/octaveAppearance";
import { useLiquidGlass } from "../../../theme/useLiquidGlass";

export function OctaveAppearanceFields({ last = true }: { last?: boolean }) {
  const { t } = useTranslation("octaveShell");
  const glass = useLiquidGlass();
  const theme = useSyncExternalStore(subscribeOctaveAppearance, getOctaveTheme, getOctaveTheme);
  const glassOn = useSyncExternalStore(subscribeOctaveAppearance, getOctaveLiquidGlass, getOctaveLiquidGlass);
  const options = useMemo<ReadonlyArray<{ value: OctaveTheme; label: string }>>(
    () => [
      { value: "same", label: t("appearance.themeSame") },
      { value: "light", label: t("appearance.themeLight") },
      { value: "dark", label: t("appearance.themeDark") },
    ],
    [t],
  );
  return (
    <>
      <div className="p-5">
        <p className="mb-2 text-sm font-medium text-content-primary">{t("appearance.theme")}</p>
        <SegmentedChoice label={t("appearance.theme")} value={theme} options={options} onChange={setOctaveTheme} />
      </div>
      {glass.toggleVisible && (
        <SettingsRow
          icon={<Sparkles size={17} />}
          label={t("appearance.glass")}
          last={last}
          trailing={<ToggleSwitch checked={glassOn} onChange={setOctaveLiquidGlass} label={t("appearance.glass")} />}
        />
      )}
    </>
  );
}
