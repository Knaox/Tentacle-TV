import { View } from "react-native";
import { Skeleton } from "../components/SkeletonLoader";
import { Colors, Spacing } from "../theme/colors";

/** Full-screen skeleton shown while lazy screens load */
export function SkeletonLoader() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep, padding: Spacing.screenPadding }}>
      <Skeleton width={200} height={28} borderRadius={6} style={{ marginTop: 40 }} />
      <Skeleton width={320} height={16} borderRadius={4} style={{ marginTop: 16 }} />
      <Skeleton width="100%" height={200} borderRadius={8} style={{ marginTop: 24 }} />
      <Skeleton width="60%" height={16} borderRadius={4} style={{ marginTop: 20 }} />
      <Skeleton width="40%" height={16} borderRadius={4} style={{ marginTop: 10 }} />
    </View>
  );
}
