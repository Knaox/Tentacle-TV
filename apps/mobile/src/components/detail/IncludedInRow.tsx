import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useIncludedInCollections } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaRow } from "../MediaRow";
import { MobileMediaCard } from "../MobileMediaCard";
import { useOpenMedia } from "@/hooks/useOpenMedia";

/**
 * « Fait partie de » : les collections de la bibliothèque qui contiennent ce
 * titre (Jellyfin 12.0+, `/Items/{id}/Collections`). Un serveur plus ancien
 * n'a pas la route, et aucune collection : la rangée ne s'affiche pas.
 */
export function IncludedInRow({ itemId }: { itemId: string }) {
  const { t } = useTranslation("media");
  const { data: collections } = useIncludedInCollections(itemId);
  const openMedia = useOpenMedia();
  const renderCard = useCallback((c: MediaItem) => <MobileMediaCard item={c} onPress={openMedia} />, [openMedia]);
  if (!collections || collections.length === 0) return null;
  return <MediaRow title={t("detailIncludedIn")} data={collections} renderItem={renderCard} />;
}
