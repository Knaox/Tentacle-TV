import { memo, useCallback, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { MediaRow } from "../../rows/MediaRow";
import { RecoCard } from "./RecoCard";
import { firstReasonText } from "./recoReasons";

export interface RecoRowActions {
  canOpen: (item: RecoRowItem) => boolean;
  onItemPress: (item: RecoRowItem) => void;
  onItemLongPress: (item: RecoRowItem) => void;
}

/**
 * `RecoRow` de l'app : sœur de `MediaRow` (même en-tête, même piste à 14
 * d'écart), pour des items qui ne sont pas des MediaItem ; la première raison
 * sous chaque carte sur la page Pour vous (`showReasons`).
 */
export const RecoRow = memo(function RecoRow({ title, items, accessory, showReasons, onSeeAll, canOpen, onItemPress, onItemLongPress }: {
  title: string;
  items: RecoRowItem[];
  accessory?: ReactNode;
  showReasons?: boolean;
  onSeeAll?: () => void;
} & RecoRowActions) {
  const { t } = useTranslation("reco");
  const renderItem = useCallback(
    (item: RecoRowItem) => (
      <RecoCard
        item={item}
        canOpen={canOpen(item)}
        onPress={() => onItemPress(item)}
        onLongPress={() => onItemLongPress(item)}
        reason={showReasons ? firstReasonText(item.reasons, t) : undefined}
      />
    ),
    [canOpen, onItemPress, onItemLongPress, showReasons, t],
  );
  return <MediaRow title={title} data={items} renderItem={renderItem} keyOf={keyOf} onSeeAll={onSeeAll} accessory={accessory} />;
});

const keyOf = (item: RecoRowItem) => item.key;
