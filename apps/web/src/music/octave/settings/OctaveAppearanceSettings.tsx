/**
 * Octave — Réglages › Apparence, le groupe « Octave » : l'apparence du mode musique, réglée À PART de celle de
 * Tentacle, sur cet appareil (Damien, 26/10) :
 *
 * - « Apparence d'Octave » : Comme Tentacle (défaut) · Clair · Sombre — appliquée quand Octave est affiché ;
 * - « Liquid Glass dans Octave » : seulement là où le verre natif existe (bureau, macOS 26) — jamais au web.
 *
 * N'existe qu'avec Octave (`useOctaveAvailability` : musique, « Accès à Octave ») ; ouvert à `#octave` (le
 * raccourci « Apparence d'Octave… » de la coquille), il se place sous les yeux.
 */

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { SettingsRow, SettingsSection } from "@tentacle-tv/ui";
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
import { useOctaveAvailability } from "../mode/useOctaveAvailability";

/** L'ancre du groupe, que vise le raccourci de la coquille. */
export const OCTAVE_APPEARANCE_ANCHOR = "octave";
export const OCTAVE_APPEARANCE_PATH = `/settings/appearance#${OCTAVE_APPEARANCE_ANCHOR}`;

/** Les deux interrupteurs Liquid Glass se montrent ensemble : celui de Tentacle se nomme alors « dans Tentacle ». */
export function useTentacleGlassLabel(): string | null {
  const { t } = useTranslation("octaveShell");
  const { available } = useOctaveAvailability();
  return available ? t("appearance.tentacleGlass") : null;
}

export function OctaveAppearanceSettings() {
  const { t } = useTranslation("octaveShell");
  const { available } = useOctaveAvailability();
  const glass = useLiquidGlass();
  const theme = useSyncExternalStore(subscribeOctaveAppearance, getOctaveTheme, getOctaveTheme);
  const glassOn = useSyncExternalStore(subscribeOctaveAppearance, getOctaveLiquidGlass, getOctaveLiquidGlass);
  const anchor = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();
  const options = useMemo<ReadonlyArray<{ value: OctaveTheme; label: string }>>(
    () => [
      { value: "same", label: t("appearance.themeSame") },
      { value: "light", label: t("appearance.themeLight") },
      { value: "dark", label: t("appearance.themeDark") },
    ],
    [t],
  );

  useEffect(() => {
    if (available && hash === `#${OCTAVE_APPEARANCE_ANCHOR}`) anchor.current?.scrollIntoView({ block: "start" });
  }, [available, hash]);

  if (!available) return null;
  return (
    <div ref={anchor} id={OCTAVE_APPEARANCE_ANCHOR} className="scroll-mt-6" data-octave-appearance>
      <SettingsSection title={t("appearance.title")} caption={t("appearance.caption")}>
        <div className="p-5">
          <p className="mb-2 text-sm font-medium text-content-primary">{t("appearance.theme")}</p>
          <SegmentedChoice label={t("appearance.theme")} value={theme} options={options} onChange={setOctaveTheme} />
        </div>
        {glass.toggleVisible && (
          <SettingsRow
            icon={<Sparkles size={17} />}
            label={t("appearance.glass")}
            last
            trailing={<ToggleSwitch checked={glassOn} onChange={setOctaveLiquidGlass} label={t("appearance.glass")} />}
          />
        )}
      </SettingsSection>
    </div>
  );
}
