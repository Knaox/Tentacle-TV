import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { PlayerLoadingView } from "@/components/player/PlayerLoadingView";
import { useLocalSource } from "@/hooks/offline/useLocalSource";
import { LocalPlayerScreen } from "@/screens/LocalPlayerScreen";
import { PlayerScreen } from "@/screens/PlayerScreen";
import { PLAYER } from "@/theme";

/**
 * L'aiguillage de la lecture : un titre présent sur l'appareil se lit DEPUIS
 * l'appareil, même en ligne ; sinon le flux serveur. La source locale est
 * revérifiée sur le disque à chaque ouverture — le lecteur serveur émet des
 * requêtes dès son montage, on ne le monte donc pas avant d'avoir la réponse.
 */
export default function WatchRoute() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { localSource, waiting, refetch } = useLocalSource(itemId);

  if (waiting) {
    return (
      <View style={{ flex: 1, backgroundColor: PLAYER.bg }}>
        <PlayerLoadingView />
      </View>
    );
  }
  if (localSource !== null) {
    return <LocalPlayerScreen itemId={itemId} localSource={localSource} onMediaMissing={() => void refetch()} />;
  }
  return <PlayerScreen itemId={itemId} />;
}
