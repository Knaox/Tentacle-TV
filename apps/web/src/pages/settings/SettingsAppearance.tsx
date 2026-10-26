import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { SettingsRow } from "@tentacle-tv/ui";
import type { ThemeMode } from "@tentacle-tv/theme";

import { useThemeMode } from "../../theme/useThemeMode";
import { useLiquidGlass } from "../../theme/useLiquidGlass";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";
import { SettingItem } from "../../components/settings/wide/SettingItem";
import { WideGroup } from "../../components/settings/wide/WideGroup";
import { settingAnchor } from "../../components/settings/wide/wideSettingsMeta";
import { OctaveAppearanceSettings, useTentacleGlassLabel } from "../../music/octave/settings/OctaveAppearanceSettings";

/**
 * Apparence — ce qui se VOIT, sur cet appareil : le thème, Liquid Glass, et
 * l'apparence d'Octave (réglée à part, posée telle quelle). Les aperçus de
 * bande-annonce au survol, un comportement des cartes et non une couleur,
 * vivent dans « Accueil et découverte ».
 *
 * Réglages PAR APPAREIL (localStorage), à ne pas confondre avec le thème de
 * marque de l'admin, lui global à l'instance.
 */

const ICON = 17;

export function SettingsAppearance() {
  const { t } = useTranslation("preferences");
  const { mode, setMode } = useThemeMode();
  const glass = useLiquidGlass();
  // Avec Octave, deux interrupteurs Liquid Glass : celui-ci se nomme « Liquid Glass dans Tentacle ».
  const glassLabel = useTentacleGlassLabel() ?? t("liquidGlassTitle");

  const modes: Array<{ id: ThemeMode; label: string; icon: ReactNode; hint?: string }> = [
    { id: "light", label: t("themeLight"), icon: <Sun size={ICON} /> },
    { id: "dark", label: t("themeDark"), icon: <Moon size={ICON} /> },
    { id: "auto", label: t("themeAuto"), icon: <Monitor size={ICON} />, hint: t("themeAutoHint") },
  ];

  return (
    <div className="max-w-2xl">
      <WideGroup section="appearance" group="theme">
        <SettingItem setting="theme">
          <div className="overflow-hidden rounded-lg border border-line-subtle">
            {modes.map((m, i) => (
              <SettingsRow
                key={m.id}
                icon={m.icon}
                label={m.label}
                description={m.hint}
                onClick={() => setMode(m.id)}
                last={i === modes.length - 1}
                trailing={mode === m.id ? (
                  <span className="text-brand" aria-label="selected"><Check size={18} /></span>
                ) : undefined}
              />
            ))}
          </div>
        </SettingItem>
      </WideGroup>

      {/* L'interrupteur n'existe que là où le verre natif existe (bureau,
          macOS 26) : au web, sous Windows, Linux ou un macOS d'avant, rien à
          régler, et le groupe entier se tait (Damien, 26/10). */}
      {glass.toggleVisible ? (
        <WideGroup section="appearance" group="effects">
          <SettingItem
            setting="liquidGlass"
            label={glassLabel}
            trailing={<ToggleSwitch checked={glass.enabled} onChange={glass.setEnabled} label={glassLabel} />}
          />
        </WideGroup>
      ) : null}

      {/* L'apparence d'Octave, réglée à part (thème ; Liquid Glass sur macOS 26) : son
          propre groupe titré, son ancre `#octave` d'avant gardée. */}
      <WideGroup section="appearance" group="octave" untitled>
        <div {...settingAnchor("octaveAppearance")} className="scroll-mt-24">
          <OctaveAppearanceSettings />
        </div>
      </WideGroup>
    </div>
  );
}
