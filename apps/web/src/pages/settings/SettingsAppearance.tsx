import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, Monitor, Moon, Sparkles, Sun } from "lucide-react";
import { SettingsRow, SettingsSection } from "@tentacle-tv/ui";
import type { ThemeMode } from "@tentacle-tv/theme";

import { useThemeMode } from "../../theme/useThemeMode";
import { useLiquidGlass } from "../../theme/useLiquidGlass";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";

/**
 * Apparence — thème clair/sombre/auto et Liquid Glass.
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

      <SettingsSection
        title={t("effects")}
        caption={
          glass.supported ? t("liquidGlassDescription") : t("liquidGlassUnavailable")
        }
      >
        <SettingsRow
          icon={<Sparkles size={ICON} />}
          label={t("liquidGlassTitle")}
          last
          trailing={
            <ToggleSwitch
              checked={glass.enabled}
              onChange={glass.setEnabled}
              label={t("liquidGlassTitle")}
            />
          }
        />
      </SettingsSection>
    </div>
  );
}
