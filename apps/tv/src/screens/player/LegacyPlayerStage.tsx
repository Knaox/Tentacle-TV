import { View } from "react-native";
import { TVPlayerView } from "../../components/player/TVPlayerView";
import { TVPlayerLoadingScreen } from "../../components/player/TVPlayerLoadingScreen";
import type { PlayerRedesignStageProps } from "../../redesignWiring/player/playerStageTypes";

/**
 * Le lecteur avec l'habillage d'Android TV — le rendu d'avant la refonte, sorti
 * tel quel de `PlayerScreen`, qui donne les mêmes props aux deux habillages.
 *
 * Item ou URL pas encore résolus : écran de chargement contextualisé — avec
 * issue de secours si la résolution du flux a échoué (erreur + « Réessayer »).
 */
export function LegacyPlayerStage(props: PlayerRedesignStageProps) {
  const { item, streamUrl } = props;
  if (!item || !streamUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <TVPlayerLoadingScreen
          item={item}
          failed={props.failed} progressLabel={props.prismStep?.label ?? null}
          onRetry={props.onRetry}
        />
      </View>
    );
  }
  return <TVPlayerView {...props} item={item} streamUrl={streamUrl} />;
}
