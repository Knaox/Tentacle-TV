import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useQualityDropNotice } from "@tentacle-tv/api-client";
import { QUALITY_DROP_NOTICE_MS, qualityDrop, type MediaSource, type QualityDrop } from "@tentacle-tv/shared";
import { SHEET_MAX_WIDTH, spacing } from "@/theme";
import { haptic } from "@/utils/haptics";
import { buildPlatformDeviceProfile } from "../../hooks/usePlaybackInfoFetch";
import type { PlayerEngineKind } from "../../player/engine/types";
import { Banner } from "../../notices/NoticeHost";

/** Ce que le lecteur sait de son flux, pour dire pourquoi la qualité baisse. */
interface DropSource {
  autoModeArmed: boolean;
  autoCap: { bitrate: number | null; measuredBps: number | null } | null;
  /** Le `MediaSource` servi par PlaybackInfo (sa `TranscodingUrl` brute). */
  mediaSource: MediaSource | null;
  engine: PlayerEngineKind;
}

/**
 * Pourquoi la qualité baisse en Auto (`player/qualityDrop.ts`) : le palier
 * du cap s'il y en a un, sinon le plafond du profil du moteur — c'est ce qui
 * a été demandé à Jellyfin, et sa limite Internet se lit en dessous.
 */
export function useMobileQualityDrop(pb: DropSource): QualityDrop | null {
  const profileMax = useMemo(() => buildPlatformDeviceProfile(pb.engine, 0, false).MaxStreamingBitrate ?? null, [pb.engine]);
  return useMemo(() => qualityDrop({
    auto: pb.autoModeArmed,
    requestedBps: pb.autoCap?.bitrate ?? profileMax,
    cap: pb.autoCap ? { measuredBps: pb.autoCap.measuredBps } : null,
    source: pb.mediaSource,
    served: pb.mediaSource,
  }), [pb.autoModeArmed, pb.autoCap, pb.mediaSource, profileMax]);
}

/**
 * « Qualité réduite » sur le lecteur du mobile et de l'iPad — la règle
 * partagée (`useQualityDropNotice`) dans la carte des avertissements, sombre
 * en dur sur la vidéo : sous la barre du haut (jamais par-dessus Retour),
 * largeur bornée sur iPad ;
 * 6 s, suspendues tant que le doigt la tient ; « Ne plus afficher » est un
 * rappel du COMPTE. Remplace l'ancien badge muet du cap.
 */
export const PlayerQualityNotice = memo(function PlayerQualityNotice({ drop, started, itemId }: {
  drop: QualityDrop | null;
  started: boolean;
  itemId: string;
}) {
  const { t, i18n } = useTranslation(["player", "notices"]);
  const insets = useSafeAreaInsets();
  const notice = useQualityDropNotice({ drop, started, itemId, locale: i18n.language });
  const view = notice.view;
  if (!view) return null;
  return (
    <View pointerEvents="box-none" style={[st.layer, { top: Math.max(insets.top, 16) + 64, left: insets.left + spacing.md, right: insets.right + spacing.md }]}>
      <View style={st.item}>
        {view.kind === "drop" ? (
          <Banner
            key={view.key}
            surface="player" severity="info" icon="activity"
            title={t("player:qualityDropTitle")}
            lines={[t(view.text.key, view.text.values)]}
            secondary={view.canDismiss ? { label: t("notices:dismissForGood"), onPress: () => { haptic("commit"); notice.dismissForGood(); } } : undefined}
            durationMs={QUALITY_DROP_NOTICE_MS}
            onDone={notice.close}
          />
        ) : (
          <Banner
            key="dismissed"
            surface="player" severity="info" icon="check"
            lines={[t("player:qualityDropDismissed")]}
            primary={{ label: t("notices:undo"), onPress: () => { haptic("tap"); notice.undo(); } }}
            durationMs={QUALITY_DROP_NOTICE_MS}
            onDone={notice.close}
          />
        )}
      </View>
    </View>
  );
});

const st = StyleSheet.create({
  layer: { position: "absolute", alignItems: "center", zIndex: 60, elevation: 60 },
  item: { width: "100%", maxWidth: SHEET_MAX_WIDTH },
});
