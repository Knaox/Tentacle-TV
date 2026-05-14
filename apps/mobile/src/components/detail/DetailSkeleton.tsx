import { View, useWindowDimensions } from "react-native";
import { Skeleton } from "@/components/ui";
import { spacing, RADIUS, SURFACE } from "@/theme";

/**
 * Skeleton MediaDetailScreen — backdrop, poster overlay, ligne titre/meta,
 * CTA placeholder. Aligné sur la layout réelle pour éviter le content jump.
 */
export function DetailSkeleton({ top }: { top: number }) {
  const { width: sw, height: sh } = useWindowDimensions();
  const backdropH = Math.round(sh * 0.52);
  const posterW = Math.round(sw * 0.32);
  const posterH = Math.round(posterW * 1.5);
  return (
    <View style={{ flex: 1, backgroundColor: SURFACE.s0, paddingTop: top }}>
      <Skeleton width="100%" height={backdropH} radius={0} />
      <View style={{ flexDirection: "row", paddingHorizontal: spacing.screenPadding, marginTop: -(posterH * 0.55) }}>
        <Skeleton width={posterW} height={posterH} radius={RADIUS.lg} />
        <View style={{ flex: 1, marginLeft: spacing.lg, justifyContent: "flex-end", gap: spacing.sm }}>
          <Skeleton width="85%" height={26} />
          <Skeleton width="55%" height={14} />
          <Skeleton width="42%" height={14} />
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.screenPadding, marginTop: spacing.xl }}>
        <Skeleton width="100%" height={52} radius={RADIUS.md} />
      </View>
    </View>
  );
}
