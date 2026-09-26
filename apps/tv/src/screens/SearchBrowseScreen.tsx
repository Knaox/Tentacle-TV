import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View, findNodeHandle, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSearchBrowse, type SearchBrowseTarget } from "@tentacle-tv/api-client";
import { personMeta, type MediaItem } from "@tentacle-tv/shared";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import type { RootStackParamList } from "../navigation/types";
import { TVPosterGrid } from "../components/search/TVPosterGrid";
import { TVPersonCard } from "../components/search/TVPersonCard";
import { TVSearchBack } from "../components/search/TVSearchBack";
import { useTVRemote } from "../components/focus/useTVRemote";
import { useTVContentEntry } from "../hooks/useTVContentEntry";
import { claimTvFocus } from "../hooks/useTvFocusClaim";
import { useTVNavActions } from "../context/TVNavContext";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { RAIL_COLLAPSED } from "../components/nav/TVSideRail";
import { Colors, Spacing, Typography } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "SearchBrowse">;

/**
 * La recherche approfondie : la filmographie d'une personne, un genre ou un
 * studio, dans la bibliothèque (`/api/search/person|genre|studio`). Rien de
 * ce qui n'est pas sur le serveur : c'est une étagère, pas un catalogue.
 *
 * La sortie se voit (parité LG) : un bouton Retour en tête, qui fait ce que
 * font la touche Retour et le Menu de la Siri Remote — revenir à la
 * recherche, qui rend alors sa barre (`SearchScreen`). Le rail reste là, et
 * « Rechercher » y est l'entrée active (`deriveRailKey`).
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

  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  useTVRemote({ onBack: goBack });
  const open = useCallback((item: MediaItem) => navigation.navigate("MediaDetail", { itemId: item.Id }), [navigation]);
  // Les cartes lisent un `MediaItem` : un résultat du moteur en est un sous-ensemble.
  const items = useMemo(() => (data?.items ?? []).map((hit) => hit.item as unknown as MediaItem), [data]);

  // Le bouton Retour est l'entrée du contenu pour le rail (pont de sortie
  // tvOS), et la mémoire de focus quand on le quitte pour lui — sans quoi elle
  // désignait encore la carte de la recherche, dessous, hors de portée.
  const contentEntry = useTVContentEntry();
  const { lastContentNodeRef } = useTVNavActions();
  const backRef = useRef<View | null>(null);
  // Sa poignée native : la première rangée d'affiches y monte (`nextFocusUp`),
  // comme la pilule Retour de la fiche.
  const [backHandle, setBackHandle] = useState<number | undefined>(undefined);
  const setBack = useCallback((node: View | null) => {
    if (!node && lastContentNodeRef.current === backRef.current) lastContentNodeRef.current = null;
    backRef.current = node;
    contentEntry(node);
    setBackHandle(node ? findNodeHandle(node) ?? undefined : undefined);
  }, [contentEntry, lastContentNodeRef]);
  // L'arrivée vise la première affiche, parité LG — et tvOS ne s'y prête pas
  // de lui-même : il pose le focus sur ce qui est en haut à gauche, Retour, en
  // ignorant la préférence de l'affiche ; et pendant un chargement, Retour
  // tient le focus quand elles arrivent. La première affiche le reprend donc,
  // tant qu'aucune n'a eu le focus (`arrived`) et qu'on n'a pas quitté Retour
  // entre-temps — vers le rail, par exemple.
  const arrived = useRef(false);
  const backFocused = useRef(false);
  const firstPoster = useRef<View | null>(null);
  const setFirstPoster = useCallback((node: View | null) => {
    firstPoster.current = node;
  }, []);
  const claimFirstPoster = useCallback(() => {
    arrived.current = true;
    return claimTvFocus(firstPoster.current);
  }, []);
  const rememberBack = useCallback(() => {
    backFocused.current = true;
    lastContentNodeRef.current = backRef.current;
    if (!arrived.current && firstPoster.current) claimFirstPoster();
  }, [lastContentNodeRef, claimFirstPoster]);
  const leaveBack = useCallback(() => {
    backFocused.current = false;
  }, []);
  const settle = useCallback(() => {
    arrived.current = true;
  }, []);
  useEffect(() => {
    if (items.length === 0 || arrived.current || !backFocused.current) return;
    return claimFirstPoster();
  }, [items.length, claimFirstPoster]);

  const header = (
    <View>
      <TVSearchBack ref={setBack} onPress={goBack} onFocus={rememberBack} onBlur={leaveBack} preferred={items.length === 0} />
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
    </View>
  );

  return (
    <TVScreenFrame>
      <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
        <TVPosterGrid
          items={items}
          width={gridWidth}
          gutter={Spacing.rowGutter}
          onOpen={open}
          header={header}
          preferFirst
          entryRef={setFirstPoster}
          onFocusCell={settle}
          firstRowUp={backHandle}
          empty={data ? undefined : isError ? (
            <Text style={{ color: Colors.textTertiary, ...Typography.body }}>{t("noResults", { query: name })}</Text>
          ) : (
            <ActivityIndicator color={Colors.textSecondary} size="large" style={{ marginTop: 80 }} />
          )}
        />
      </View>
    </TVScreenFrame>
  );
}
