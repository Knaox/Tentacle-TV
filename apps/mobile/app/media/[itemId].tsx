import { useLocalSearchParams } from "expo-router";
import { MediaDetailScreen } from "@/screens/MediaDetailScreen";

export default function MediaDetailRoute() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  return <MediaDetailScreen itemId={itemId} />;
}
