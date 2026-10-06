import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useConnectivityNotice } from "@tentacle-tv/api-client";
import { CONNECTIVITY_OFFLINE_MODE_KEY } from "@tentacle-tv/shared";
import { SHEET_MAX_WIDTH, spacing } from "@/theme";
import { useScreenReaderEnabled } from "@/hooks/useScreenReaderEnabled";
import { Banner } from "@/notices/NoticeHost";
import { useConnectivity } from "./useConnectivity";

/**
 * Le passage hors ligne, DIT — jamais un voile : l'application est déjà sur
 * ce qu'il y a sur l'appareil. Un message TEMPORAIRE, compte à rebours
 * visible (`useConnectivityNotice`, règle partagée), qui dit l'un des trois
 * cas — pas de réseau, serveur Tentacle hors ligne, Jellyfin injoignable —
 * puis s'efface ; il reparaît à la bascule suivante, ou si la cause change.
 * Jamais en mode manuel : l'utilisateur l'a demandé lui-même. Sur le lecteur,
 * il attend la sortie (comme les autres avertissements) ; lecteur d'écran
 * actif, pas de compte à rebours.
 */
export const ConnectivityNoticeBanner = memo(function ConnectivityNoticeBanner() {
  const { t } = useTranslation("errors");
  const insets = useSafeAreaInsets();
  const { state, reason } = useConnectivity();
  const notice = useConnectivityNotice(state === "offline-auto", reason);
  const screenReader = useScreenReaderEnabled();
  const [root] = useSegments();
  // Sur le lecteur, il attend la sortie : le lecteur a ses propres messages.
  if (!notice || root === "watch") return null;
  return (
    <View
      pointerEvents="box-none"
      style={[st.layer, { top: Math.max(insets.top, 16) + spacing.sm, left: insets.left + spacing.md, right: insets.right + spacing.md }]}
    >
      <View style={st.item}>
        <Banner
          key={notice.occasion}
          severity="info"
          icon={notice.kind === "device" ? "wifi-off" : "server"}
          title={t(notice.titleKey)}
          lines={[t(notice.hintKey), t(CONNECTIVITY_OFFLINE_MODE_KEY)]}
          durationMs={screenReader ? null : notice.durationMs}
          onDone={notice.done}
        />
      </View>
    </View>
  );
});

const st = StyleSheet.create({
  // Au-dessus des écrans et des autres avertissements : la bascule les explique.
  layer: { position: "absolute", alignItems: "center", zIndex: 950, elevation: 950 },
  item: { width: "100%", maxWidth: SHEET_MAX_WIDTH },
});
