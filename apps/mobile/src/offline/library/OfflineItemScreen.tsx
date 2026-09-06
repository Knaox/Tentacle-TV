import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { DetailSkeleton } from "@/components/detail/DetailSkeleton";
import { useMediaDetailAnimations } from "@/hooks/useMediaDetailAnimations";
import { removeOfflineEntry, setLocalWatched, type OfflineEntry } from "@/offline/engineApi";
import { OfflineRowActionsSheet } from "@/offline/manage/OfflineRowActionsSheet";
import { backOrHome } from "@/utils/backOrHome";
import { ITEM_BANNER_ART } from "./offlineArt";
import { OfflineDetailShell, useOfflineDetailMetrics } from "./OfflineDetailShell";
import { OfflineItemBody } from "./OfflineItemBody";
import { OfflineItemHeader } from "./OfflineItemHeader";
import { useOfflineItem } from "./useOfflineItem";

/**
 * La fiche locale d'un film ou d'un épisode gardé sur l'appareil — la parité
 * de la fiche en ligne, plein écran, avec pour seule source la base et le
 * snapshot : bannière en parallaxe, affiche, méta, casting, la carte « Sur
 * l'appareil » (version, taille, vu, auto-suppression, retrait) et les
 * épisodes frères. Un titre retiré ou incomplet renvoie d'où l'on vient.
 */
export function OfflineItemScreen({ itemId }: { itemId: string }) {
  const { t } = useTranslation(["offline", "common"]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const metrics = useOfflineDetailMetrics();
  const local = useOfflineItem(itemId);
  const [more, setMore] = useState<OfflineEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const { entry, userId } = local;

  // Sans DTO (snapshot non récupéré), un item minimal suffit à la cascade d'entrée.
  const animItem = useMemo<MediaItem | undefined>(
    () => (entry ? (local.item ?? { Id: itemId, Name: entry.title ?? "", Type: entry.kind === "episode" ? "Episode" : "Movie" }) : undefined),
    [entry, local.item, itemId],
  );
  const anims = useMediaDetailAnimations(itemId, animItem, metrics.backdropH);

  useEffect(() => {
    if (local.isFetched && (!entry || entry.status !== "complete")) backOrHome(router);
  }, [local.isFetched, entry, router]);

  const play = useCallback((target: OfflineEntry) => router.push(`/watch/${target.itemId}` as never), [router]);
  const info = useCallback((target: OfflineEntry) => {
    if (target.itemId !== itemId) router.push(`/on-device/item/${target.itemId}` as never);
  }, [router, itemId]);
  const toggleWatched = useCallback((target: OfflineEntry, played: boolean) => {
    if (userId !== null) setLocalWatched(userId, target.itemId, played);
  }, [userId]);
  const remove = useCallback(() => {
    if (!entry || userId === null) return;
    Alert.alert(t("offline:removeConfirmTitle"), t("offline:removeConfirmMessage"), [
      { text: t("common:cancel"), style: "cancel" },
      {
        text: t("offline:remove"),
        style: "destructive",
        onPress: () => {
          setBusy(true);
          void removeOfflineEntry(userId, entry.id).finally(() => {
            setBusy(false);
            backOrHome(router);
          });
        },
      },
    ]);
  }, [entry, userId, t, router]);

  if (!entry) return <DetailSkeleton top={insets.top} />;

  return (
    <>
      <OfflineDetailShell
        backdropItemId={itemId}
        backdropCandidates={ITEM_BANNER_ART}
        anims={anims}
        metrics={metrics}
        header={
          <OfflineItemHeader
            entry={entry}
            item={local.item}
            seriesKey={local.seriesKey}
            seasonKey={local.seasonKey}
            remainingMinutes={local.remainingMinutes}
            metrics={metrics}
            anims={anims}
            onPlay={play}
          />
        }
        body={
          <OfflineItemBody
            entry={entry}
            item={local.item}
            userId={userId}
            people={local.people}
            genres={local.genres}
            siblings={local.siblings}
            seasonName={local.seasonName}
            busy={busy}
            onPlay={play}
            onMore={setMore}
            onToggleWatched={toggleWatched}
            onRemove={remove}
          />
        }
      />
      <OfflineRowActionsSheet entry={more} onClose={() => setMore(null)} onPlay={play} onInfo={info} />
    </>
  );
}
