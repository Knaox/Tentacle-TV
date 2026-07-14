import { View, useWindowDimensions } from "react-native";
import { Skeleton } from "@/components/ui";
import { spacing, RADIUS, DETAIL_MAX_WIDTH, useTheme } from "@/theme";

/**
 * Skeleton MediaDetailScreen — backdrop, poster overlay, ligne titre/meta,
 * CTA placeholder. Aligné sur la layout réelle pour éviter le content jump.
 */
export function DetailSkeleton({ top }: { top: number }) {
  const { colors } = useTheme();
  const { width: sw, height: sh } = useWindowDimensions();
  // Bornés comme l'écran réel (cap 520/200) + colonne 920 centrée → pas de saut
  // de contenu à l'arrivée des données sur iPad.
  const backdropH = Math.min(520, Math.round(sh * 0.52));
  const posterW = Math.min(200, Math.round(sw * 0.32));
  const posterH = Math.round(posterW * 1.5);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.s0, paddingTop: top }}>
      <View style={{ width: "100%", maxWidth: DETAIL_MAX_WIDTH, alignSelf: "center" }}>
        <Skeleton width="100%" height={backdropH} radius={0} />
        <View style={{ flexDirection: "row", paddingHorizontal: spacing.screenPadding, marginTop: -(posterH * 0.55) }}>
          <Skeleton width={posterW} height={posterH} radius={RADIUS.lg} />
          <View style={{ flex: 1, marginLeft: spacing.lg, justifyContent: "flex-end", gap: spacing.sm }}>
            <Skeleton width="85%" height={26} />
            <Skeleton width="55%" height={14} />
            <Skeleton width="42%" height={14} />
          </View>
        </View>
        <View style={{ paddingHorizontal: spacing.screenPadding, marginTop: spacing.xl, maxWidth: 420 }}>
          <Skeleton width="100%" height={52} radius={RADIUS.md} />
        </View>
      </View>
    </View>
  );
}
