import { useEffect } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { TVTrackSelector } from "../../components/TVTrackSelector";
import { useSettingsPanelProps, notifySettingsClosed } from "./playerSettingsBridge";

/**
 * Route MODALE transparente du panneau Réglages/Qualité, au-dessus du Player.
 * tvOS : le bouton Menu ferme proprement la modale (révèle l'épisode dessous)
 * sans le flash du pop d'écran poussé. Le contenu vient du bridge (publié par
 * PlayerScreen). Au démontage (ESC natif OU bouton Fermer) on resynchronise le
 * Player via notifySettingsClosed().
 */
export function PlayerSettingsScreen() {
  const navigation = useNavigation();
  const props = useSettingsPanelProps();

  // Démontage (ESC natif ou goBack) → resynchronise l'état côté PlayerScreen.
  useEffect(() => () => notifySettingsClosed(), []);

  if (!props) return null;
  return (
    <View style={{ flex: 1 }}>
      {/* TVTrackSelector garde son back interne (useTVRemote, gaté par
          useIsFocused → seule la modale le traite, pas le Player dessous) :
          ESC → onClose → goBack → dismiss propre de la modale. */}
      <TVTrackSelector
        {...props}
        onClose={() => navigation.goBack()}
      />
    </View>
  );
}
