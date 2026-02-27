import { useCallback } from "react";
import { View, ScrollView, Text } from "react-native";
import { useLibraryItems } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVMediaCard } from "../components/TVMediaCard";
import { Focusable } from "../components/focus/Focusable";
import { Skeleton } from "../components/SkeletonLoader";
import { useTVRemote } from "../components/focus/useTVRemote";
import { Colors, Spacing, Typography, Radius, CardConfig } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Library">;

const COLUMNS = 6;
const CARD_W = CardConfig.portrait.width;
const CARD_H = CARD_W / CardConfig.portrait.aspectRatio;

export function LibraryScreen({ route, navigation }: Props) {
  const { libraryId, libraryName } = route.params;
  const { t } = useTranslation("common");
  const { data: items, isLoading } = useLibraryItems(libraryId, { limit: 100 });

  useTVRemote({ onBack: () => navigation.goBack() });

  const navigateToDetail = useCallback((item: MediaItem) => {
    navigation.navigate("MediaDetail", { itemId: item.Id });
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
      <ScrollView contentContainerStyle={{
        padding: Spacing.screenPadding,
        paddingBottom: 80,
      }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 28 }}>
          <Focusable onPress={() => navigation.goBack()} hasTVPreferredFocus>
            <View style={{
              paddingHorizontal: 20, paddingVertical: 10,
              borderRadius: Radius.small,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1, borderColor: Colors.glassBorder,
            }}>
              <Text style={{ color: Colors.accentPurpleLight, ...Typography.buttonMedium }}>
                {t("back")}
              </Text>
            </View>
          </Focusable>
          <Text style={{
            color: Colors.textPrimary, ...Typography.pageTitle,
            marginLeft: 20,
          }}>
            {libraryName}
          </Text>
        </View>

        {/* Loading skeleton */}
        {isLoading && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} width={CARD_W} height={CARD_H} />
            ))}
          </View>
        )}

        {/* Items grid */}
        {!isLoading && items && items.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {items.map((item) => (
              <Focusable key={item.Id} onPress={() => navigateToDetail(item)} noBorder>
                <TVMediaCard item={item} variant="portrait" />
              </Focusable>
            ))}
          </View>
        )}

        {/* Empty state */}
        {!isLoading && (!items || items.length === 0) && (
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <Text style={{ color: Colors.textTertiary, ...Typography.sectionTitle }}>
              {t("noResults", { defaultValue: "No items found" })}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
