import { View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { DetailActionButton } from "./DetailActionButton";
import { DetailKeepOfflineButton } from "@/offline/entry/DetailKeepOfflineButton";
import { spacing, useTheme } from "@/theme";

interface MutationHandle { mutate: () => void }
interface FavHandle { add: MutationHandle; remove: MutationHandle }
interface ToggleHandle { add: MutationHandle; remove: MutationHandle }
interface WatchedHandle { markWatched: MutationHandle; markUnwatched: MutationHandle }

interface Props {
  target?: MediaItem;
  /** Le titre AFFICHÉ (film, épisode, série) : cible du bouton « Garder hors ligne ». */
  item?: MediaItem;
  isWatched: boolean;
  favorite: FavHandle;
  watchlist: ToggleHandle;
  watched: WatchedHandle;
}

/**
 * Row des actions (Favoris / Ma liste / Vu / Garder hors ligne) — pattern
 * Apple TV, colonnes fixes. Labels courts via i18n
 * `actionFavorite`/`actionMyList`/`actionWatched`. La quatrième colonne, libre
 * par construction, porte le bouton du hors ligne (film et épisode ; la série
 * a le sien).
 */
export function DetailActionsRow({ target, item, isWatched, favorite, watchlist, watched }: Props) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const isFav = !!target?.UserData?.IsFavorite;
  const isInList = !!target?.UserData?.Likes;

  return (
    <View style={st.row}>
      <DetailActionButton
        icon="heart"
        iconActive="heart"
        label={t("actionFavorite")}
        active={isFav}
        activeColor={theme.colors.status.error}
        fillOnActive
        onPress={() => isFav ? favorite.remove.mutate() : favorite.add.mutate()}
      />
      <DetailActionButton
        icon="plus"
        iconActive="check"
        label={t("actionMyList")}
        active={isInList}
        activeColor={theme.colors.brand.violet}
        onPress={() => isInList ? watchlist.remove.mutate() : watchlist.add.mutate()}
      />
      <DetailActionButton
        icon="check-circle"
        iconActive="check-circle"
        label={t("actionWatched")}
        active={isWatched}
        activeColor={theme.colors.brand.violet}
        fillOnActive
        onPress={() => isWatched ? watched.markUnwatched.mutate() : watched.markWatched.mutate()}
      />
      {item && item.Type !== "Series" && <DetailKeepOfflineButton item={item} />}
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
    // Grand écran (iPad) : garder les 3 boutons groupés, alignés sur le bouton
    // Play (borné 420) au lieu de s'écarter sur toute la largeur. iPhone < 420 → inchangé.
    maxWidth: 420 + spacing.screenPadding * 2,
  },
});
