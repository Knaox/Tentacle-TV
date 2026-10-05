import { memo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useJellyfinOutage } from "@tentacle-tv/api-client";
import { jellyfinOutageCopy } from "@tentacle-tv/shared";
import { SHEET_MAX_WIDTH, spacing } from "@/theme";
import { haptic } from "@/utils/haptics";
import { Banner } from "../../notices/NoticeHost";

/**
 * Jellyfin redémarre, s'arrête, démarre — dit par le serveur Tentacle
 * (`server:jellyfin`), sur le lecteur du mobile et de l'iPad : la carte du
 * lecteur, sous la barre du haut, tant que dure la panne (aucun compte à
 * rebours). Quand elle dure (`long`), elle propose « Réessayer » ; la
 * position reste gardée. Les mêmes phrases que le web et la TV
 * (`jellyfinOutageCopy`).
 */
export const JellyfinOutageBanner = memo(function JellyfinOutageBanner({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("player");
  const insets = useSafeAreaInsets();
  const outage = useJellyfinOutage();
  const [closedState, setClosedState] = useState<string | null>(null);
  if (outage.phase !== "outage" && outage.phase !== "long") return null;
  const long = outage.phase === "long";
  // Chassée du doigt : elle revient au prochain changement d'état, ou quand la panne dure.
  if (!long && closedState === outage.state) return null;
  const copy = jellyfinOutageCopy(outage.state, long);
  if (!copy) return null;
  return (
    <View pointerEvents="box-none" style={[st.layer, { top: Math.max(insets.top, 16) + 64, left: insets.left + spacing.md, right: insets.right + spacing.md }]}>
      <View style={st.item}>
        <Banner
          key={`${outage.state}-${long}`}
          surface="player" severity={long ? "blocking" : "info"} icon="server"
          title={t(copy.titleKey)}
          lines={[t(copy.hintKey)]}
          primary={long ? { label: t("jellyfinOutage.retry"), onPress: () => { haptic("commit"); onRetry(); } } : undefined}
          durationMs={null}
          onDone={() => setClosedState(outage.state)}
        />
      </View>
    </View>
  );
});

const st = StyleSheet.create({
  // Au-dessus de la carte « Qualité réduite » (60) : la panne en est la cause.
  layer: { position: "absolute", alignItems: "center", zIndex: 65, elevation: 65 },
  item: { width: "100%", maxWidth: SHEET_MAX_WIDTH },
});
