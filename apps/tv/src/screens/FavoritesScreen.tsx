import { useCallback } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useFavoritesAll } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { AmbientFocusProvider, useAmbientFocus } from "../contexts/AmbientFocusContext";
import { TVAmbientBackdrop } from "../components/ambient/TVAmbientBackdrop";
import { TVLibraryGrid } from "../components/library/TVLibraryGrid";
import { TVCollectionEmpty } from "../components/library/TVCollectionEmpty";
import { useTVRemote } from "../components/focus/useTVRemote";
import { useTVContentEntry } from "../hooks/useTVContentEntry";
import { HeartIcon } from "../components/icons/TVActionIcons";
import { Colors, Spacing, Typography } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Favorites">;

/**
 * Mes favoris en page parcourable (`Filters=IsFavorite`) — grille simple,
 * comme la LG : ni sélection multiple ni partage sur téléviseur.
 */
export function FavoritesScreen(props: Props) {
  return (
    <AmbientFocusProvider>
      <FavoritesScreenInner {...props} />
    </AmbientFocusProvider>
  );
}

function FavoritesScreenInner({ navigation }: Props) {
  const { t } = useTranslation("common");
  const { data, isLoading } = useFavoritesAll();
  const { setFocusedItem } = useAmbientFocus();
  useTVRemote({ onBack: () => navigation.goBack() });
  // Sélection au rail → focus sur la 1ʳᵉ carte de la grille.
  const contentEntry = useTVContentEntry();

  const openDetail = useCallback((item: MediaItem) => {
    navigation.navigate("MediaDetail", { itemId: item.Id });
  }, [navigation]);

  const items = data ?? [];

  return (
    <TVScreenFrame>
      <TVAmbientBackdrop />
      <View style={{ flex: 1 }}>
        <Text style={{
          color: Colors.textPrimary, ...Typography.pageTitle,
          paddingHorizontal: Spacing.rowGutter, marginBottom: 20,
        }}>
          {t("myFavorites")}
        </Text>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={Colors.accentPurple} />
          </View>
        ) : items.length === 0 ? (
          <TVCollectionEmpty
            icon={<HeartIcon size={44} color={Colors.textTertiary} />}
            title={t("emptyFavorites")}
            hint={t("emptyFavoritesHint")}
          />
        ) : (
          <TVLibraryGrid listKey="favorites" items={items} onPressItem={openDetail} onItemFocus={setFocusedItem} entryRef={contentEntry} />
        )}
      </View>
    </TVScreenFrame>
  );
}
