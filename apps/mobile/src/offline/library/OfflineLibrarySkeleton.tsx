import { View } from "react-native";
import { Skeleton, SkeletonCard, SkeletonHero } from "@/components/ui";
import { spacing, type GridLayout } from "@/theme";

interface Props {
  layout: GridLayout;
}

/**
 * Le squelette de l'accueil hors ligne, calé sur la géométrie réelle du
 * bandeau (`useHeroMetrics`) : rien ne saute à l'arrivée des données.
 */
export function OfflineLibrarySkeleton({ layout }: Props) {
  return (
    <View>
      <SkeletonHero />
      <View style={{ paddingHorizontal: spacing.screenPadding, marginTop: spacing.lg }}>
        <Skeleton width={220} height={14} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: layout.gutter, paddingHorizontal: layout.padding, marginTop: spacing.xxl }}>
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} width={layout.itemWidth} height={Math.round(layout.itemWidth * 1.5)} />
        ))}
      </View>
    </View>
  );
}
