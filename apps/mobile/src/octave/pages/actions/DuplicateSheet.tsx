/**
 * Octave mobile — « Déjà dans la playlist — l'ajouter quand même ? » : la boîte
 * du mobile pour la demande commune (`askDuplicate`, api-client). Une alerte du
 * système : claire au pouce, lue par VoiceOver et TalkBack.
 */

import { useEffect } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { answerDuplicate, useDuplicateAsk } from "@tentacle-tv/api-client";

export function DuplicateSheet() {
  const { t } = useTranslation("music");
  const ask = useDuplicateAsk();
  useEffect(() => {
    if (!ask) return;
    Alert.alert(
      t("playlist.duplicateTitle"),
      t("playlist.duplicateMessage", { title: ask.title, name: ask.playlist }),
      [
        { text: t("playlist.duplicateCancel"), style: "cancel", onPress: () => answerDuplicate(false) },
        { text: t("playlist.duplicateConfirm"), onPress: () => answerDuplicate(true) },
      ],
      { cancelable: true, onDismiss: () => answerDuplicate(false) },
    );
  }, [ask, t]);
  return null;
}
