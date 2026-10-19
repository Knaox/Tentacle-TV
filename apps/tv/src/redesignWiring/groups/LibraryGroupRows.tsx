import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLibraryCatalog, type CatalogFilters } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import type { LibraryGroup, OpenCardMetrics } from "@tentacle-tv/tv-core";
import { usePlatformFilter } from "../../hooks/usePlatformFilter";
import type { CardModel } from "../../redesign/cards/cardTypes";
import { useOpenCardMetrics } from "../../redesign/openRow/OpenCardPage";
import { OpenRowSection } from "../../redesign/openRow/OpenRowSection";
import { useCardModels } from "../cards/cardModels";
import { yearSubtitle } from "../grid/usePosterGrid";
import { groupTitle } from "./groupTitle";
import { groupRowParams } from "./libraryRowParams";
import type { RowCardActions } from "./useRowCardActions";

/**
 * Les RANGÉES d'une bibliothèque (tv-core `groups/libraryGroups.ts`) : chacune
 * sa requête, ses affiches page à page (la suite quand le focus approche de
 * la fin). Seules les rangées proches se chargent : les `FETCH_AHEAD`
 * premières, puis jusqu'à `FETCH_AHEAD` au-delà de la rangée focalisée ; les
 * autres attendent en affiches fantômes, à leur hauteur (rien ne bouge).
 *
 * Clé d'une rangée : `group:<groupe>` ; ses cartes, `group:<groupe>:<index>`.
 */
const FETCH_AHEAD = 2;
const NO_ITEMS: MediaItem[] = [];

export function groupRowKey(group: LibraryGroup): string {
  return `group:${group.key}`;
}

export const LibraryGroupRows = memo(function LibraryGroupRows({ libraryId, groups, base, platformIds, actions }: {
  libraryId: string;
  groups: LibraryGroup[];
  base: CatalogFilters;
  platformIds: number[];
  actions: RowCardActions;
}) {
  const metrics = useOpenCardMetrics();
  const [reach, setReach] = useState(FETCH_AHEAD);
  const onReach = useCallback((rank: number) => setReach((r) => Math.max(r, rank + FETCH_AHEAD)), []);
  return (
    <>
      {groups.map((group, rank) => (
        <LibraryGroupRow
          key={group.key}
          libraryId={libraryId}
          group={group}
          base={base}
          platformIds={platformIds}
          rank={rank}
          enabled={rank <= reach}
          metrics={metrics}
          actions={actions}
          onReach={onReach}
        />
      ))}
    </>
  );
});

const LibraryGroupRow = memo(function LibraryGroupRow({ libraryId, group, base, platformIds, rank, enabled, metrics, actions, onReach }: {
  libraryId: string;
  group: LibraryGroup;
  base: CatalogFilters;
  platformIds: number[];
  rank: number;
  enabled: boolean;
  metrics: OpenCardMetrics;
  actions: RowCardActions;
  onReach: (rank: number) => void;
}) {
  const { t } = useTranslation();
  const params = useMemo(() => ({ ...groupRowParams(base, group), enabled }), [base, group, enabled]);
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useLibraryCatalog(libraryId, params);
  const loaded = useMemo(() => data?.pages.flatMap((page) => page.Items) ?? NO_ITEMS, [data]);
  // Plateformes : le serveur ne sait pas filtrer, la rangée filtre ce qu'elle a.
  const { filteredItems } = usePlatformFilter(loaded, platformIds);
  const items = platformIds.length > 0 ? filteredItems : loaded;
  const { register, onFocusCard: focusCard } = actions;
  useEffect(() => register(items), [register, items]);
  const cards = useCardModels(items, { variant: "poster", subtitle: yearSubtitle });
  const onNearEnd = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const onFocusCard = useCallback((card: CardModel) => {
    onReach(rank);
    focusCard(card);
  }, [onReach, rank, focusCard]);
  // Le compte d'une tranche est celui des comptes ; sinon celui du serveur, exact.
  const count = platformIds.length > 0 ? undefined : group.slice ? group.count : data?.pages[0]?.TotalRecordCount ?? group.count;
  return (
    <OpenRowSection
      rowKey={groupRowKey(group)}
      title={groupTitle(t, group.label)}
      count={count}
      cards={cards}
      metrics={metrics}
      pending={!data}
      rank={rank}
      onPressCard={actions.onPressCard}
      onLongPressCard={actions.onLongPressCard}
      onFocusCard={onFocusCard}
      onNearEnd={onNearEnd}
    />
  );
});
