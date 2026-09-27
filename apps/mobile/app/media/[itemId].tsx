import { useLocalSearchParams } from "expo-router";
import { MediaDetailScreen } from "@/screens/MediaDetailScreen";
import { useDetailChain } from "@/hooks/useDetailChain";

export default function MediaDetailRoute() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  // Une fiche ouverte depuis une fiche prend sa place : un seul retour ramène
  // à l'écran d'où la chaîne est partie (cf. `utils/detailChain`).
  useDetailChain();
  return <MediaDetailScreen itemId={itemId} />;
}
