import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  useHomeLayout,
  useJellyfinClient,
  useMediaItem,
  useSaveHomeLayoutPatch,
  useServerCapabilities,
  useUserId,
} from "@tentacle-tv/api-client";
import { heroModesOffered, type HeroMode } from "@tentacle-tv/shared";
import { heroModeOf, heroSourcePress } from "@tentacle-tv/tv-core";
import type { ChoiceListModel, SettingsHome } from "../../redesign/screens/settings/settingsTypes";

/** Les favoris proposés pour « Un titre choisi » : les noms seuls, triés — rien à afficher d'autre. */
const FAVORITES_LIMIT = 200;

interface FavoriteTitle {
  Id: string;
  Name: string;
}

/**
 * L'onglet « Personnalisation » des téléviseurs : la source du bandeau
 * principal, réglage du COMPTE gardé par le serveur (`useHomeLayout`), écrit
 * en « lire avant d'écrire » (`useSaveHomeLayoutPatch` : seul `heroMode` /
 * `heroFixedItemId` change, un autre appareil qui écrit au même moment n'est
 * pas écrasé). Les sources proposées sont celles que CE serveur sait servir
 * (shared `heroModesOffered`) ; ce que fait OK, tv-core `heroSourcePress`.
 *
 * Les favoris ne se lisent que l'onglet ouvert (`active`), en noms seuls ;
 * leur liste s'ouvre dans la liste de choix des réglages.
 */
export function useHomeSettings(active: boolean) {
  const { t } = useTranslation("homeSettings");
  const layoutQuery = useHomeLayout();
  const layout = layoutQuery.data;
  const current = heroModeOf(layout, layoutQuery.isError);
  const { capabilities } = useServerCapabilities();
  const save = useSaveHomeLayoutPatch();
  const client = useJellyfinClient();
  const userId = useUserId();

  const favorites = useQuery({
    queryKey: ["favorites", "titles", userId],
    queryFn: () =>
      client
        .fetch<{ Items: FavoriteTitle[] }>(
          `/Users/${userId}/Items?Filters=IsFavorite&Recursive=true&IncludeItemTypes=Movie,Series` +
            `&SortBy=SortName&SortOrder=Ascending&Limit=${FAVORITES_LIMIT}&EnableImages=false&EnableUserData=false`,
        )
        .then((r) => r.Items.map(({ Id, Name }) => ({ Id, Name }))),
    enabled: active && !!userId,
    staleTime: 60_000,
  });
  const fixedId = current === "fixed" ? (layout?.heroFixedItemId ?? undefined) : undefined;
  const fixedItem = useMediaItem(active ? fixedId : undefined);

  const [picking, setPicking] = useState(false);
  const [noFavorites, setNoFavorites] = useState(false);

  const home = useMemo<SettingsHome | null>(() => {
    if (!layout || !current) return null;
    return {
      modes: heroModesOffered(capabilities, current),
      current,
      fixedTitle: fixedItem.data?.Id === fixedId ? fixedItem.data?.Name : undefined,
      // Demandé sans favori, ou la liste attendue s'est révélée vide.
      noFavorites: noFavorites || (picking && favorites.data?.length === 0),
    };
  }, [layout, current, capabilities, fixedItem.data, fixedId, noFavorites, picking, favorites.data]);

  const selectHeroMode = useCallback((mode: HeroMode) => {
    if (!current) return;
    const press = heroSourcePress(mode, { current, favorites: favorites.data?.length ?? null });
    setNoFavorites(press.kind === "noFavorites");
    if (press.kind === "save") save.mutate({ heroMode: press.mode });
    if (press.kind === "pickFixed") setPicking(true);
  }, [current, favorites.data, save]);

  const choiceList = useMemo<ChoiceListModel | null>(() => {
    // Jamais une liste vide : elle s'ouvre avec les favoris lus.
    if (!picking || !favorites.data?.length) return null;
    return {
      title: t("heroFixedPickTitle"),
      context: t("heroFixedPickContext"),
      options: (favorites.data ?? []).map((item) => ({ value: item.Id, label: item.Name })),
      selected: layout?.heroFixedItemId ?? "",
    };
  }, [picking, favorites.data, layout?.heroFixedItemId, t]);

  const closeChoices = useCallback(() => setPicking(false), []);
  const chooseFixed = useCallback((id: string) => {
    setPicking(false);
    if (id) save.mutate({ heroMode: "fixed", heroFixedItemId: id });
  }, [save]);

  return {
    home,
    choiceList,
    onSelectHeroMode: selectHeroMode,
    onChangeFixedTitle: useCallback(() => setPicking(true), []),
    onChoose: chooseFixed,
    closeChoices,
  };
}
