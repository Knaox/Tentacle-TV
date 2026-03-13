import { useLocalSearchParams } from "expo-router";
import { SharedWatchlistDetailScreen } from "@/screens/SharedWatchlistDetailScreen";

export default function SharedWatchlistRoute() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  return <SharedWatchlistDetailScreen listId={listId!} />;
}
