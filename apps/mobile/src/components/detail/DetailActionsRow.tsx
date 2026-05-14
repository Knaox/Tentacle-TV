import { View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { DetailActionButton } from "./DetailActionButton";
import { BRAND, spacing, STATUS } from "@/theme";

interface MutationHandle { mutate: () => void }
interface FavHandle { add: MutationHandle; remove: MutationHandle }
interface ToggleHandle { add: MutationHandle; remove: MutationHandle }
interface WatchedHandle { markWatched: MutationHandle; markUnwatched: MutationHandle }

interface Props {
  target?: MediaItem;
  isWatched: boolean;
  favorite: FavHandle;
  watchlist: ToggleHandle;
  watched: WatchedHandle;
  onOpenShareSheet: () => void;
}

/**
 * Row des 4 actions (Favoris / Ma liste / Partager / Vu) — pattern Apple TV,
 * grille 4 colonnes fixes. Labels courts via i18n `actionFavorite`/`actionMyList`/
 * `actionShare`/`actionWatched` (R2 MASTER design-system).
 */
export function DetailActionsRow({ target, isWatched, favorite, watchlist, watched, onOpenShareSheet }: Props) {
  const { t } = useTranslation("common");
  const isFav = !!target?.UserData?.IsFavorite;
  const isInList = !!target?.UserData?.Likes;

  return (
    <View style={st.row}>
      <DetailActionButton
        icon="heart"
        iconActive="heart"
        label={t("actionFavorite")}
        active={isFav}
        activeColor={STATUS.error}
        fillOnActive
        onPress={() => isFav ? favorite.remove.mutate() : favorite.add.mutate()}
      />
      <DetailActionButton
        icon="plus"
        iconActive="check"
        label={t("actionMyList")}
        active={isInList}
        activeColor={BRAND.violet}
        onPress={() => isInList ? watchlist.remove.mutate() : watchlist.add.mutate()}
      />
      <DetailActionButton
        icon="users"
        label={t("actionShare")}
        active={false}
        activeColor={BRAND.violet}
        onPress={onOpenShareSheet}
      />
      <DetailActionButton
        icon="check-circle"
        iconActive="check-circle"
        label={t("actionWatched")}
        active={isWatched}
        activeColor={BRAND.violet}
        fillOnActive
        onPress={() => isWatched ? watched.markUnwatched.mutate() : watched.markWatched.mutate()}
      />
    </View>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.screenPadding,
  },
});
