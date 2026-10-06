import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useOutageNotice } from "@tentacle-tv/api-client";
import { SHEET_MAX_WIDTH, spacing } from "@/theme";
import { useScreenReaderEnabled } from "@/hooks/useScreenReaderEnabled";
import { haptic } from "@/utils/haptics";
import { Banner } from "../../notices/NoticeHost";

/**
 * Jellyfin redémarre, s'arrête, démarre — dit par le serveur Tentacle
 * (`server:jellyfin`), sur le lecteur du mobile et de l'iPad : la carte du
 * lecteur, sous la barre du haut, TEMPORAIRE, compte à rebours visible
 * (`useOutageNotice`, la règle du web) — elle reparaît à chaque nouvel état.
 * Quand la panne dure, elle propose « Réessayer » ; la position reste
 * gardée. Lecteur d'écran actif : pas de compte à rebours, comme les autres
 * avertissements. Les mêmes phrases que le web et la TV (`jellyfinOutageCopy`).
 */
export const JellyfinOutageBanner = memo(function JellyfinOutageBanner({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("player");
  const insets = useSafeAreaInsets();
  const notice = useOutageNotice();
  const screenReader = useScreenReaderEnabled();
  if (!notice) return null;
  return (
    <View pointerEvents="box-none" style={[st.layer, { top: Math.max(insets.top, 16) + 64, left: insets.left + spacing.md, right: insets.right + spacing.md }]}>
      <View style={st.item}>
        <Banner
          key={notice.occasion}
          surface="player" severity={notice.long ? "blocking" : "info"} icon="server"
          title={t(notice.copy.titleKey)}
          lines={[t(notice.copy.hintKey)]}
          primary={notice.long ? { label: t("jellyfinOutage.retry"), onPress: () => { haptic("commit"); notice.done(); onRetry(); } } : undefined}
          durationMs={screenReader ? null : notice.durationMs}
          onDone={notice.done}
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
