import { useCallback } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useWatchlistAll } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { AmbientFocusProvider, usePoseurAmbiant } from "../contexts/AmbientFocusContext";
import { TVAmbientBackdrop } from "../components/ambient/TVAmbientBackdrop";
import { TVLibraryGrid } from "../components/library/TVLibraryGrid";
import { TVCollectionEmpty } from "../components/library/TVCollectionEmpty";
import { useTVRemote } from "../components/focus/useTVRemote";
import { useTVContentEntry } from "../hooks/useTVContentEntry";
import { BookmarkIcon } from "../components/icons/TVIcons";
import { Colors, Spacing, Typography } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Watchlist">;

/**
 * Ma liste en page parcourable — les mêmes éléments que la rangée de
 * l'accueil, en grille complète (`Filters=Likes`). Comme la LG : une grille
 * simple, SANS sélection multiple ni partage (boutons inatteignables au
 * D-pad, retirés du portage téléviseur).
 */
export function WatchlistScreen(props: Props) {
  return (
    <AmbientFocusProvider>
      <WatchlistScreenInner {...props} />
    </AmbientFocusProvider>
  );
}

function WatchlistScreenInner({ navigation }: Props) {
  const { t } = useTranslation("common");
  const { data, isLoading } = useWatchlistAll();
  const setFocusedItem = usePoseurAmbiant();
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
          {t("myList")}
        </Text>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={Colors.accentPurple} />
          </View>
        ) : items.length === 0 ? (
          <TVCollectionEmpty
            icon={<BookmarkIcon size={44} color={Colors.textTertiary} />}
            title={t("emptyWatchlist")}
            hint={t("emptyWatchlistHint")}
            // Sans action, cet écran n'a aucun focusable : l'anneau n'a nulle
            // part où se poser et la télécommande devient muette.
            action={{
              libelle: t("browseLibraries"),
              onPress: () => navigation.navigate("Home"),
              entryRef: contentEntry,
            }}
          />
        ) : (
          <TVLibraryGrid listKey="watchlist" items={items} onPressItem={openDetail} onItemFocus={setFocusedItem} entryRef={contentEntry} />
        )}
      </View>
    </TVScreenFrame>
  );
}
