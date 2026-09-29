import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useIncludedInCollections } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaRow } from "../MediaRow";
import { MobileMediaCard } from "../MobileMediaCard";

/**
 * « Fait partie de » : les collections de la bibliothèque qui contiennent ce
 * titre (Jellyfin 12.0+, `/Items/{id}/Collections`). Un serveur plus ancien
 * n'a pas la route, et aucune collection : la rangée ne s'affiche pas.
 */
export function IncludedInRow({ itemId }: { itemId: string }) {
  const router = useRouter();
  const { t } = useTranslation("media");
  const { data: collections } = useIncludedInCollections(itemId);
  if (!collections || collections.length === 0) return null;
  return (
    <MediaRow title={t("detailIncludedIn")} data={collections}
      renderItem={(c: MediaItem) => <MobileMediaCard item={c} onPress={() => router.push(`/media/${c.Id}`)} />} />
  );
}
