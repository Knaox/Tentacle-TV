import { useTranslation } from "react-i18next";
import { useThemeMode } from "@/theme";
import { BrandSwitch } from "./BrandSwitch";
import { SettingsRow } from "./SettingsRow";

/**
 * Bascule Liquid Glass — NE REND RIEN si le rendu natif n'est pas supporté
 * (iOS < 26, Android), de sorte que l'option est absente là où elle n'a aucun
 * effet. Quand supporté : interrupteur + description du repli verre maison.
 */
export function LiquidGlassRow({ last }: { last?: boolean }) {
  const { t } = useTranslation("preferences");
  const { liquidGlass } = useThemeMode();
  if (!liquidGlass.supported) return null;
  return (
    <SettingsRow
      icon="droplet"
      label={t("liquidGlassTitle")}
      description={t("liquidGlassDescription")}
      last={last}
      trailing={
        <BrandSwitch
          value={liquidGlass.enabled}
          onValueChange={liquidGlass.setEnabled}
          accessibilityLabel={t("liquidGlassTitle")}
        />
      }
    />
  );
}
