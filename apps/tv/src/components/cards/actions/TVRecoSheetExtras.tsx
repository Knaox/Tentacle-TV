import { useTranslation } from "react-i18next";
import { useRecoSettings, useSaveRecoProviderFilter } from "@tentacle-tv/api-client";
import { TVCardSheetButton } from "./TVCardSheetButton";
import { FilterOffIcon } from "./sheetIcons";

/**
 * « Toutes les plateformes », sous un filtre de plateformes actif — l'action
 * propre aux recommandations du téléviseur, qui SUIT celles du modèle. La
 * pastille du filtre n'est pas atteignable depuis une carte éloignée à droite
 * (HAUT rejoint la rangée du dessus) ; la feuille, elle, l'est depuis toutes.
 *
 * Composant à part : les réglages reco ne se lisent que pour une carte reco.
 */
export function TVRecoSheetExtras({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("reco");
  const { data: settings } = useRecoSettings();
  const saveFilter = useSaveRecoProviderFilter();
  if ((settings?.providerFilter.length ?? 0) === 0) return null;
  return (
    <TVCardSheetButton
      icon={<FilterOffIcon size={24} color="#FFFFFF" />}
      label={t("providersAll")}
      onPress={() => {
        onDone();
        saveFilter.mutate([]);
      }}
      testID="card-sheet-providers-all"
    />
  );
}
