import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, Monitor, Moon, Sparkles, Sun } from "lucide-react";
import { SettingsRow, SettingsSection } from "@tentacle-tv/ui";
import type { ThemeMode } from "@tentacle-tv/theme";

import { useThemeMode } from "../../theme/useThemeMode";
import { useLiquidGlass } from "../../theme/useLiquidGlass";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";
import { TrailerPreviewSetting } from "../../components/settings/TrailerPreviewSetting";
import { OctaveAppearanceSettings, useTentacleGlassLabel } from "../../music/octave/settings/OctaveAppearanceSettings";

/**
 * Apparence — thème clair/sombre/auto, Liquid Glass et les aperçus de
 * bande-annonce au survol.
 *
 * Réglages PAR APPAREIL (localStorage), à ne pas confondre avec le thème de
 * marque de l'admin, lui global à l'instance. Les deux cohabitent : l'admin
 * choisit la marque, l'utilisateur choisit son schéma.
 */

const ICON = 17;

export function SettingsAppearance() {
  const { t } = useTranslation("preferences");
  const { mode, setMode } = useThemeMode();
  const glass = useLiquidGlass();
  // Avec Octave, deux interrupteurs Liquid Glass : celui-ci se nomme « Liquid Glass dans Tentacle ».
  const glassLabel = useTentacleGlassLabel() ?? t("liquidGlassTitle");
  const glassCaption = glass.nativeSupported
    ? t("liquidGlassNativeDescription")
    : glass.supported
      ? t("liquidGlassDescription")
      : t("liquidGlassUnavailable");

  const modes: Array<{ id: ThemeMode; label: string; icon: ReactNode; hint?: string }> = [
    { id: "light", label: t("themeLight"), icon: <Sun size={ICON} /> },
    { id: "dark", label: t("themeDark"), icon: <Moon size={ICON} /> },
    { id: "auto", label: t("themeAuto"), icon: <Monitor size={ICON} />, hint: t("themeAutoHint") },
  ];

  return (
    <div className="max-w-2xl">
      <SettingsSection title={t("theme")} caption={t("appearanceDescription")}>
        {modes.map((m, i) => (
          <SettingsRow
            key={m.id}
            icon={m.icon}
            label={m.label}
            description={m.hint}
            onClick={() => setMode(m.id)}
            last={i === modes.length - 1}
            trailing={
              mode === m.id ? (
                <span className="text-brand" aria-label="selected">
                  <Check size={18} />
                </span>
              ) : undefined
            }
          />
        ))}
      </SettingsSection>

      {/* L'interrupteur n'existe que là où le verre natif existe (bureau,
          macOS 26) : au web, sous Windows, Linux ou un macOS d'avant, rien à
          régler, et la section entière se tait (Damien, 26/10). */}
      {glass.toggleVisible ? (
        <SettingsSection title={t("effects")} caption={glassCaption}>
          <SettingsRow
            icon={<Sparkles size={ICON} />}
            label={glassLabel}
            last
            trailing={
              <ToggleSwitch
                checked={glass.enabled}
                onChange={glass.setEnabled}
                label={glassLabel}
              />
            }
          />
        </SettingsSection>
      ) : null}

      {/* Les aperçus de bande-annonce au survol des cartes : un comportement de
          l'interface, réglé par appareil comme le thème et le verre. */}
      {/* L'apparence d'Octave, réglée à part (thème ; Liquid Glass sur macOS 26). */}
      <OctaveAppearanceSettings />

      <TrailerPreviewSetting />
    </div>
  );
}
