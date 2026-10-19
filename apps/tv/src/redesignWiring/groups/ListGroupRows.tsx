import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import type { GroupableItem, ItemGroup, OpenCardMetrics } from "@tentacle-tv/tv-core";
import { useOpenCardMetrics } from "../../redesign/openRow/OpenCardPage";
import { OpenRowSection } from "../../redesign/openRow/OpenRowSection";
import { useCardModels } from "../cards/cardModels";
import { yearSubtitle } from "../grid/usePosterGrid";
import { groupTitle } from "./groupTitle";
import type { RowCardActions } from "./useRowCardActions";

/**
 * Les RANGÉES d'une liste — Ma liste, Mes favoris (tv-core
 * `groups/listGroups.ts`) : toute la liste est en mémoire, chaque titre dans
 * une seule rangée. Clé d'une rangée : `group:<groupe>` ; ses cartes,
 * `group:<groupe>:<index>`.
 */

const ANIMATED = /anim/i;

/** Ce que le rangement lit d'un titre. */
export function groupableOf(item: MediaItem): GroupableItem {
  const genres = item.Genres ?? [];
  return {
    id: item.Id,
    title: item.Name ?? "",
    kind: item.Type === "Movie" ? "movie" : item.Type === "Series" ? "series" : "other",
    animated: genres.some((genre) => ANIMATED.test(genre)),
    genres,
    year: item.ProductionYear ?? null,
    rating: item.CommunityRating ?? null,
  };
}

export function listRowKey(group: ItemGroup): string {
  return `group:${group.key}`;
}

export const ListGroupRows = memo(function ListGroupRows({ groups, items, actions }: {
  groups: ItemGroup[];
  items: readonly MediaItem[];
  actions: RowCardActions;
}) {
  const metrics = useOpenCardMetrics();
  const byId = useMemo(() => new Map(items.map((item) => [item.Id, item])), [items]);
  return (
    <>
      {groups.map((group, rank) => (
        <ListGroupRow key={group.key} group={group} byId={byId} rank={rank} metrics={metrics} actions={actions} />
      ))}
    </>
  );
});

const ListGroupRow = memo(function ListGroupRow({ group, byId, rank, metrics, actions }: {
  group: ItemGroup;
  byId: ReadonlyMap<string, MediaItem>;
  rank: number;
  metrics: OpenCardMetrics;
  actions: RowCardActions;
}) {
  const { t } = useTranslation();
  const items = useMemo(() => group.ids.map((id) => byId.get(id)).filter((item): item is MediaItem => !!item), [group, byId]);
  const cards = useCardModels(items, { variant: "poster", subtitle: yearSubtitle });
  return (
    <OpenRowSection
      rowKey={listRowKey(group)}
      title={groupTitle(t, group.label)}
      count={items.length}
      cards={cards}
      metrics={metrics}
      rank={rank}
      onPressCard={actions.onPressCard}
      onLongPressCard={actions.onLongPressCard}
      onFocusCard={actions.onFocusCard}
    />
  );
});
