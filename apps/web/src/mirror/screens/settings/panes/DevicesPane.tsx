import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Cast } from "lucide-react";
import { MyDevicesSection } from "../../../../components/settings/MyDevicesSection";
import { SettingsRow } from "../ui/SettingsRow";
import { SettingsSection } from "../ui/SettingsSection";

/**
 * `DevicesPane` de l'app (`PairedDevicesSection`) : « Jumeler TV » en tête
 * (ligne de marque vers l'écran de jumelage), puis la liste des appareils et
 * leur révocation — celle du web, `MyDevicesSection`, confirmée par dialogue.
 */
export function DevicesPane() {
  const { t } = useTranslation("profile");
  const navigate = useNavigate();
  return (
    <>
      <SettingsSection>
        <SettingsRow icon={Cast} label={t("pairTV")} accent chevron last onPress={() => navigate("/pair-device")} />
      </SettingsSection>
      <MyDevicesSection />
    </>
  );
}
