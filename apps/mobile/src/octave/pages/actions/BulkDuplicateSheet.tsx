/**
 * Octave mobile — la règle de doublon d'un ajout GROUPÉ (« 2 des 11 titres sont déjà dans X ») pour la demande
 * commune (`askBulkDuplicates`, api-client, la même que la boîte du bureau). Une alerte du système : tout ajouter,
 * ajouter sans les doublons, ou rien — « sans les doublons » disparaît quand TOUS y sont déjà.
 */

import { useEffect } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { answerBulkDuplicates, useBulkDuplicateAsk } from "@tentacle-tv/api-client";

export function BulkDuplicateSheet() {
  const { t } = useTranslation("music");
  const ask = useBulkDuplicateAsk();
  useEffect(() => {
    if (!ask) return;
    const allThere = ask.duplicates >= ask.total;
    Alert.alert(
      t("playlist.duplicateTitle"),
      allThere ? t("selection.allDuplicates", { count: ask.total, name: ask.playlist }) : t("selection.someDuplicates", { count: ask.duplicates, total: ask.total, name: ask.playlist }),
      [
        { text: t("playlist.duplicateCancel"), style: "cancel", onPress: () => answerBulkDuplicates("cancel") },
        ...(allThere ? [] : [{ text: t("selection.skipDuplicates"), onPress: () => answerBulkDuplicates("skip") }]),
        { text: t("playlist.duplicateConfirm"), onPress: () => answerBulkDuplicates("all") },
      ],
      { cancelable: true, onDismiss: () => answerBulkDuplicates("cancel") },
    );
  }, [ask, t]);
  return null;
}
