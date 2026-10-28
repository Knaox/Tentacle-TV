/**
 * Octave (mobile) — « Retester la connexion », la première ligne de Réglages ›
 * Hors ligne tant que l'application est hors ligne (`retestRule.ts`) : une
 * sonde forcée qui se MONTRE (`useProbeRetry` : la même que le voile et la
 * pastille), qui quitte le hors ligne choisi, et qui dit quand le serveur ne
 * répond toujours pas. Le serveur répond : l'application repasse en ligne,
 * et la ligne disparaît avec le hors ligne.
 */

import { memo, useCallback, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings";
import { setManualOffline } from "@/offline/connectivityStore";
import { useConnectivity } from "@/offline/useConnectivity";
import { useProbeRetry } from "@/offline/useProbeRetry";
import { useTheme } from "@/theme";
import { retestLine } from "../retestRule";

export const RetestConnectionRow = memo(function RetestConnectionRow({ last }: { last?: boolean }) {
  const { t } = useTranslation("musicOffline");
  const { colors } = useTheme();
  const { state } = useConnectivity();
  const { isChecking, retry } = useProbeRetry();
  const [tried, setTried] = useState(false);
  const line = retestLine(state, isChecking, tried);
  const onPress = useCallback(() => {
    // Hors ligne par choix : en sortir relance déjà la sonde ; l'essai visible la double sans attente de plus.
    if (state === "offline-manual") setManualOffline(false);
    void retry().finally(() => setTried(true));
  }, [retry, state]);
  if (line === "hidden") return null;
  return (
    <SettingsRow
      icon="refresh-cw"
      label={t("retest.label")}
      description={t(`retest.${line}`)}
      onPress={isChecking ? undefined : onPress}
      accent
      trailing={isChecking ? <ActivityIndicator size="small" color={colors.text.secondary} /> : undefined}
      accessibilityLabel={t("retest.label")}
      last={last}
    />
  );
});
