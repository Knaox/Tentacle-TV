import { Platform, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SettingBlock } from "./SettingBlock";
import {
  exoMatchFrameRateStore, exoTunnelingStore, useExoMatchFrameRate, useExoTunneling,
} from "../../lib/exoSettings";

/**
 * Réglages d'APPAREIL du lecteur — Android TV seulement, tvOS n'a pas
 * d'ExoPlayer : ce qui dépend du décodeur de CE téléviseur, à l'inverse des
 * réglages de compte juste au-dessus. Même forme : des boutons, pas
 * d'interrupteur. Un changement s'applique à la lecture SUIVANTE (le lecteur se
 * construit avec).
 */
export function TVDevicePlaybackSection() {
  const { t } = useTranslation("preferences");
  const tunneling = useExoTunneling();
  const matchFrameRate = useExoMatchFrameRate();
  if (Platform.OS !== "android") return null;
  return (
    <View>
      <SettingBlock
        title={t("exoTunnelingLabel")}
        hint={t("exoTunnelingHint")}
        value={tunneling ? "on" : "off"}
        choices={[
          { value: "off", label: t("reglageDesactive") },
          { value: "on", label: t("reglageActive") },
        ]}
        onChoose={(value) => exoTunnelingStore.set(value === "on")}
      />
      <SettingBlock
        title={t("exoMatchFrameRateLabel")}
        hint={t("exoMatchFrameRateHint")}
        value={matchFrameRate ? "on" : "off"}
        choices={[
          { value: "off", label: t("reglageDesactive") },
          { value: "on", label: t("reglageActive") },
        ]}
        onChoose={(value) => exoMatchFrameRateStore.set(value === "on")}
      />
    </View>
  );
}
