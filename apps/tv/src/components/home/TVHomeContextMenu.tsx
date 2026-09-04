import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { SelectionModal } from "../SelectionModal";

/** Ce que vise l'appui long : une carte Jellyfin de l'accueil. */
export type HomeContextTarget = { kind: "media"; item: MediaItem };

interface Props {
  target: HomeContextTarget | null;
  onClose: () => void;
  onDetail: (itemId: string) => void;
  onPlay: (itemId: string) => void;
}

/**
 * Le menu contextuel de l'accueil (appui long sur une carte) : « Plus
 * d'infos », « Lecture ». Possède la modale de sélection ; extrait de
 * `HomeScreen` (règle des 300 lignes) — il grandit avec les rangées de
 * recommandation.
 */
export function TVHomeContextMenu({ target, onClose, onDetail, onPlay }: Props) {
  const { t } = useTranslation("common");

  const handleSelect = useCallback((value: string) => {
    const current = target;
    onClose();
    if (!current) return;
    if (value === "details") onDetail(current.item.Id);
    else if (value === "play") onPlay(current.item.Id);
  }, [target, onClose, onDetail, onPlay]);

  if (!target) return null;
  const { item } = target;
  return (
    <SelectionModal
      title={item.Type === "Episode" ? (item.SeriesName ?? item.Name) : item.Name}
      options={[
        { value: "details", label: t("moreInfo") },
        { value: "play", label: t("play") },
      ]}
      selectedValue={null}
      onSelect={handleSelect}
      onClose={onClose}
    />
  );
}
