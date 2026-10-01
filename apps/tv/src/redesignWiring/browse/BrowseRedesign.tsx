import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useJellyfinClient, useSearchBrowse, type SearchBrowseTarget } from "@tentacle-tv/api-client";
import { initials, personMeta, type MediaItem } from "@tentacle-tv/shared";
import { TV_STAGE } from "@tentacle-tv/theme";
import type { RootStackParamList } from "../../navigation/types";
import { BrowseView } from "../../redesign/screens/browse/BrowseView";
import type { StatusPanelProps } from "../../redesign/screens/shared/StatusPanel";
import { useBackFocus } from "../focus/backFocus";
import { usePosterGrid } from "../grid/usePosterGrid";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useRedesignScreen } from "../screen/useRedesignScreen";

type Params = RootStackParamList["SearchBrowse"];

/** Le portrait, net sur une Apple TV 4K (échelle 2). */
const PORTRAIT_HEIGHT = TV_STAGE.card.person.size * 2;

/**
 * Parcourir, refondu (Apple TV) : la filmographie d'une personne, un genre ou
 * un studio, dans la bibliothèque (`/api/search/person|genre|studio`) — une
 * étagère, pas un catalogue. Un morceau de la recherche : « Rechercher » reste
 * actif dans la navigation, et Menu, Retour comme « Rechercher » y ramènent
 * (la recherche rend alors sa barre).
 *
 * L'arrivée vise la première affiche (parité LG). Pendant un chargement, la
 * croix Retour — seule action — tient le focus : la première affiche le
 * reprend à son arrivée, tant qu'aucune affiche ne l'a eu ; « Réessayer »
 * aussi, si l'erreur arrive. Arrivée sur une page déjà là, la croix ne le
 * prend jamais (`useBackFocus`) ; « haut », depuis n'importe quelle affiche
 * de la première rangée, la rend (groupe `browse:header`).
 */
export function BrowseRedesign({ kind, id, name }: Params) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const client = useJellyfinClient();
  const target = useMemo<SearchBrowseTarget | null>(() => {
    if (kind === "person") return id ? { kind: "person", id } : null;
    return { kind, name };
  }, [kind, id, name]);
  const { data, isError, refetch } = useSearchBrowse(target, 120);
  // Les cartes lisent un `MediaItem` : un résultat du moteur en est un sous-ensemble.
  const items = useMemo(() => (data?.items ?? []).map((hit) => hit.item as unknown as MediaItem), [data]);
  const grid = usePosterGrid(items);
  const person = kind === "person";

  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  const onBack = useCallback(() => {
    goBack();
    return true;
  }, [goBack]);
  const retry = useCallback(() => void refetch(), [refetch]);

  const failed = isError && !data;
  const loading = target !== null && !data && !failed;
  const status: StatusPanelProps | null = failed
    ? {
        kind: "error",
        title: person ? t("media:personLoadError") : t("common:contentErrorTitle"),
        message: t("common:contentErrorMessage"),
        primary: { label: t("common:retry"), icon: "refresh", onPress: retry },
      }
    : null;
  const empty = !loading && !status && items.length === 0
    ? { title: person ? t("media:personLibraryEmpty") : t("common:noResultsLibrary") }
    : null;
  const order = person ? t("search:sortedByYear") : t("search:sortedByRating");
  const meta = data ? `${person && data.person ? personMeta(t, data.person) : t("search:countTitles", { count: data.total })} · ${order}` : undefined;
  const portraitUri = person && data?.person?.imageTag
    ? client.getImageUrl(data.person.id, "Primary", { height: PORTRAIT_HEIGHT, tag: data.person.imageTag, quality: 85 })
    : undefined;

  const entryKey = status ? "status:primary" : items.length > 0 ? "grid:0" : "browse:back";
  const screen = useRedesignScreen({ railKey: "Search", entryKey, onBack, onReselect: goBack });
  const { focus } = screen;
  // L'en-tête (ou, sur l'erreur, la bande de la croix) mène à la croix : un
  // guide à destination — un guide `autoFocus` n'y menait que si elle avait
  // déjà eu le focus (mesuré : jamais, arrivé sur une page déjà là).
  useBackFocus(focus, { backKey: "browse:back", barKey: "browse:header", entryKey });

  // tvOS pose d'abord le focus en haut à gauche — Retour —, et Retour le
  // garde pendant un chargement : la première affiche le reprend en arrivant,
  // tant qu'aucune affiche ne l'a eu.
  const posterSeen = useRef(false);
  useEffect(() => focus.subscribe((key, focused) => {
    if (focused && key.startsWith("grid:")) posterSeen.current = true;
  }), [focus]);
  useEffect(() => {
    if (items.length === 0 || posterSeen.current || focus.focusedKey() !== "browse:back") return;
    return focus.claim("grid:0");
  }, [items.length, focus]);
  // L'erreur après un chargement : la croix avait le focus (seule action), « Réessayer » le reprend.
  useEffect(() => {
    if (!failed || posterSeen.current || focus.focusedKey() !== "browse:back") return;
    return focus.claim("status:primary");
  }, [failed, focus]);

  return (
    <RedesignScreen screen={screen}>
      <BrowseView
        nav={screen.nav}
        kind={kind}
        kicker={person ? t("search:filmographyTitle") : t(`search:${kind}`)}
        name={name}
        meta={meta}
        portraitUri={portraitUri}
        initials={person ? initials(name) : undefined}
        cards={grid.cards}
        palette={grid.palette}
        loading={loading}
        empty={empty}
        status={status}
        onBack={goBack}
        onPressCard={grid.onPressCard}
        onLongPressCard={grid.onLongPressCard}
        onFocusCard={grid.onFocusCard}
      />
      {grid.sheet}
    </RedesignScreen>
  );
}
