import { useLocalSearchParams } from "expo-router";
import { DETAIL_SEASON_PARAM } from "@tentacle-tv/shared";
import { MediaDetailScreen } from "@/screens/MediaDetailScreen";
import { useDetailChain } from "@/hooks/useDetailChain";

export default function MediaDetailRoute() {
  const params = useLocalSearchParams<{ itemId: string; [DETAIL_SEASON_PARAM]?: string }>();
  const { itemId } = params;
  // Une fiche ouverte depuis une fiche prend sa place : un seul retour ramène
  // à l'écran d'où la chaîne est partie (cf. `utils/detailChain`).
  useDetailChain();
  // Une carte regroupée des « Derniers ajouts » ouvre la série sur une saison.
  return <MediaDetailScreen itemId={itemId} openSeasonId={params[DETAIL_SEASON_PARAM]} />;
}
