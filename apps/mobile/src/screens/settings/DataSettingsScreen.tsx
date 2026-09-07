import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { SettingsSection, SettingsRow } from "@/components/settings";
import { SettingsScaffold } from "@/screens/settings/SettingsScaffold";
import { useDataSaverActive, useDataSaverSetting } from "@/offline/useDataSaver";
import type { DataSaverSetting } from "@/offline/dataSaverStore";
import { useTheme } from "@/theme";

const MODES: ReadonlyArray<{ id: DataSaverSetting; icon: keyof typeof Feather.glyphMap; label: string; hint: string }> = [
  { id: "auto", icon: "activity", label: "saverModeAuto", hint: "saverModeAutoHint" },
  { id: "on", icon: "wifi-off", label: "saverModeOn", hint: "saverModeOnHint" },
  { id: "off", icon: "wifi", label: "saverModeOff", hint: "saverModeOffHint" },
];

/**
 * Données — le mode économie. Réglage PAR APPAREIL, comme le thème : la
 * qualité de connexion dépend de l'endroit où tourne l'application, pas du
 * compte. `auto` par défaut : la latence mesurée par les sondes et le réseau
 * du téléphone décident ; les deux forçages couvrent ce que la mesure ne peut
 * pas savoir (lien rapide mais facturé au volume, ou lent mais illimité).
 */
export function DataSettingsScreen() {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const theme = useTheme();
  const { setting, setSetting } = useDataSaverSetting();
  const active = useDataSaverActive();

  const caption = active ? `${t("saverSettingsCaption")} — ${t("saverActiveNow")}` : t("saverSettingsCaption");

  return (
    <SettingsScaffold title={to("dataTitle")}>
      <SettingsSection title={t("saverSettingsTitle")} caption={caption}>
        {MODES.map((mode, index) => (
          <SettingsRow
            key={mode.id}
            icon={mode.icon}
            label={t(mode.label)}
            description={t(mode.hint)}
            last={index === MODES.length - 1}
            onPress={() => setSetting(mode.id)}
            trailing={setting === mode.id ? <Feather name="check" size={18} color={theme.colors.brand.violet} /> : undefined}
          />
        ))}
      </SettingsSection>
    </SettingsScaffold>
  );
}
