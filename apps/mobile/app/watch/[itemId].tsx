import { useLocalSearchParams } from "expo-router";
import { PlayerScreen } from "@/screens/PlayerScreen";

export default function WatchRoute() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  return <PlayerScreen itemId={itemId} />;
}
