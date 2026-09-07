import { useLocalSearchParams } from "expo-router";
import { OfflineItemScreen } from "@/offline/library/OfflineItemScreen";

export default function OfflineItemRoute() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  return <OfflineItemScreen itemId={itemId ?? ""} />;
}
