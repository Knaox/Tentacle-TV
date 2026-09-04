import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRecoSettings, useSaveRecoProviderFilter, useSendRecoFeedback } from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { SelectionModal } from "../SelectionModal";

/** Ce que vise l'appui long : une carte Jellyfin de l'accueil, ou une
 *  recommandation (en bibliothèque — la TV ne montre pas les autres). */
export type HomeContextTarget =
  | { kind: "media"; item: MediaItem }
  | { kind: "reco"; item: RecoRowItem };

interface Props {
  target: HomeContextTarget | null;
  onClose: () => void;
  onDetail: (itemId: string) => void;
  onPlay: (itemId: string) => void;
}

/**
 * Le menu contextuel de l'accueil (appui long sur une carte) : « Plus
 * d'infos », « Lecture » — et, sur une recommandation, « Ne plus me
 * proposer » (retrait optimiste de toutes les pages en cache) et, sous un
 * filtre de plateformes, « Toutes les plateformes » : la pastille du filtre
 * n'est pas atteignable depuis une carte éloignée à droite (HAUT rejoint la
 * rangée du dessus), le menu l'est depuis n'importe quelle carte. Possède la
 * modale de sélection ; extrait de `HomeScreen` (règle des 300 lignes).
 */
export function TVHomeContextMenu({ target, onClose, onDetail, onPlay }: Props) {
  const { t } = useTranslation("common");
  const { t: tReco } = useTranslation("reco");
  const feedback = useSendRecoFeedback();
  const { data: settings } = useRecoSettings();
  const saveFilter = useSaveRecoProviderFilter();
  const filterActive = (settings?.providerFilter.length ?? 0) > 0;

  const handleSelect = useCallback((value: string) => {
    const current = target;
    onClose();
    if (!current) return;
    const itemId = current.kind === "media" ? current.item.Id : current.item.jellyfinItemId;
    if (value === "details" && itemId) onDetail(itemId);
    else if (value === "play" && itemId) onPlay(itemId);
    else if (value === "dismiss" && current.kind === "reco") {
      feedback.mutate({ itemKey: current.item.key, action: "dismissed" });
    } else if (value === "clearFilter") {
      saveFilter.mutate([]);
    }
  }, [target, onClose, onDetail, onPlay, feedback, saveFilter]);

  if (!target) return null;
  const options = [
    { value: "details", label: t("moreInfo") },
    { value: "play", label: t("play") },
  ];
  if (target.kind === "reco") {
    options.push({ value: "dismiss", label: tReco("dismissAction") });
    if (filterActive) options.push({ value: "clearFilter", label: tReco("providersAll") });
  }
  const title = target.kind === "media"
    ? (target.item.Type === "Episode" ? (target.item.SeriesName ?? target.item.Name) : target.item.Name)
    : target.item.title;
  return (
    <SelectionModal
      title={title}
      options={options}
      selectedValue={null}
      onSelect={handleSelect}
      onClose={onClose}
    />
  );
}
