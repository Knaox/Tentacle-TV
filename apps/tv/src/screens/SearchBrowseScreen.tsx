import { useCallback, useMemo } from "react";
import { ActivityIndicator, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSearchBrowse, type SearchBrowseTarget } from "@tentacle-tv/api-client";
import { personMeta, type MediaItem } from "@tentacle-tv/shared";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import type { RootStackParamList } from "../navigation/types";
import { TVPosterGrid } from "../components/search/TVPosterGrid";
import { TVPersonCard } from "../components/search/TVPersonCard";
import { useTVRemote } from "../components/focus/useTVRemote";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { RAIL_COLLAPSED } from "../components/nav/TVSideRail";
import { Colors, Spacing, Typography } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "SearchBrowse">;

/**
 * La recherche approfondie : la filmographie d'une personne, un genre ou un
 * studio, dans la bibliothèque (`/api/search/person|genre|studio`). Rien de
 * ce qui n'est pas sur le serveur : c'est une étagère, pas un catalogue.
 */
export function SearchBrowseScreen({ navigation, route }: Props) {
  const { t } = useTranslation("search");
  const { kind, id, name } = route.params;
  const { width: windowW } = useWindowDimensions();
  const gridWidth = windowW - RAIL_COLLAPSED - TV_OVERSCAN_PT.x - Spacing.rowGutter * 2;

  const target = useMemo<SearchBrowseTarget | null>(() => {
    if (kind === "person") return id ? { kind: "person", id } : null;
    return { kind, name };
  }, [kind, id, name]);
  const { data, isError } = useSearchBrowse(target, 120);

  useTVRemote({ onBack: () => navigation.goBack() });
  const open = useCallback((item: MediaItem) => navigation.navigate("MediaDetail", { itemId: item.Id }), [navigation]);
  // Les cartes lisent un `MediaItem` : un résultat du moteur en est un sous-ensemble.
  const items = useMemo(() => (data?.items ?? []).map((hit) => hit.item as unknown as MediaItem), [data]);

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 32, paddingTop: 16, paddingBottom: 32 }}>
      {kind === "person" && data?.person && <TVPersonCard person={data.person} />}
      <View style={{ flex: 1 }}>
        <Text style={{ color: Colors.textTertiary, fontSize: 13, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" }}>
          {kind === "person" ? t("filmographyTitle") : t(kind)}
        </Text>
        <Text numberOfLines={1} style={{ color: Colors.textPrimary, ...Typography.detailTitle, marginTop: 6 }}>{name}</Text>
        {data && (
          <Text style={{ color: Colors.textSecondary, ...Typography.meta, marginTop: 8 }}>
            {kind === "person" && data.person ? personMeta(t, data.person) : t("countTitles", { count: data.total })}
            {"  ·  "}
            {kind === "person" ? t("sortedByYear") : t("sortedByRating")}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <TVScreenFrame>
      <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
        {data ? (
          <TVPosterGrid items={items} width={gridWidth} gutter={Spacing.rowGutter} onOpen={open} header={header} preferFirst />
        ) : (
          <View style={{ flex: 1, paddingHorizontal: Spacing.rowGutter }}>
            {header}
            {isError ? (
              <Text style={{ color: Colors.textTertiary, ...Typography.body }}>{t("noResults", { query: name })}</Text>
            ) : (
              <ActivityIndicator color={Colors.textSecondary} size="large" style={{ marginTop: 80 }} />
            )}
          </View>
        )}
      </View>
    </TVScreenFrame>
  );
}
