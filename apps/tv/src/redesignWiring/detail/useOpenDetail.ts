import { useCallback, useMemo, useRef } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { detailMove, type DetailTarget } from "@tentacle-tv/tv-core";
import { detailPageOf } from "../../navigation/detailPage";
import type { RootStackParamList } from "../../navigation/types";

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type AnyRoute = { key: string; name: string; params?: object };

/** Ce qu'une fiche à ouvrir doit dire d'elle : son identifiant, et pour un
 *  épisode ou une saison, sa série et sa saison (les champs Jellyfin). */
export interface TitleRef {
  Id: string;
  SeriesId?: string | null;
  SeasonId?: string | null;
}

export interface OpenDetail {
  /** La fiche d'un titre. */
  openTitle: (item: TitleRef) => void;
  /** La page d'une personne (sa filmographie). */
  openPerson: (person: { id: string; name: string }) => void;
}

/**
 * Ouvrir une page de détail selon la règle de la SUITE DE FICHES (Apple TV,
 * `detailMove`, tv-core) : depuis une autre fiche — un similaire, un volet de
 * la saga, une personne du casting, « Plus d'infos » du grand panneau, une
 * carte de la filmographie —, elle REMPLACE la page courante, et un seul
 * Retour ramène là où l'on était avant la première fiche ; descendre d'une
 * série vers ses épisodes empile, comme avant ; la page juste dessous, on y
 * recule. Ailleurs (accueil, bibliothèque, recherche…), elle s'empile.
 *
 * La route de l'écran qui appelle et celle de dessous sont lues dans la pile
 * au moment du geste. Le focus rendu à la carte d'origine est celui de la
 * page révélée : rien ne se remplace sous elle.
 */
export function useOpenDetail(): OpenDetail {
  const navigation = useNavigation<Navigation>();
  const route = useRoute();
  const latest = useRef({ navigation, routeKey: route.key });
  latest.current = { navigation, routeKey: route.key };

  const go = useCallback((target: DetailTarget, push: (nav: Navigation) => void, replace: (nav: Navigation) => void) => {
    const { navigation: nav, routeKey } = latest.current;
    const { routes } = nav.getState();
    const index = routes.findIndex((r) => r.key === routeKey);
    const from = detailPageOf(routes[index] as AnyRoute | undefined);
    const below = index > 0 ? detailPageOf(routes[index - 1] as AnyRoute) : null;
    switch (detailMove(from, target, below)) {
      case "push":
        push(nav);
        return;
      case "replace":
        replace(nav);
        return;
      case "back":
        nav.goBack();
        return;
      case "stay":
        return;
    }
  }, []);

  const openTitle = useCallback((item: TitleRef) => {
    const params = { itemId: item.Id };
    go(
      { kind: "title", id: item.Id, seriesId: item.SeriesId, seasonId: item.SeasonId },
      (nav) => nav.push("MediaDetail", params),
      (nav) => nav.replace("MediaDetail", params),
    );
  }, [go]);

  const openPerson = useCallback((person: { id: string; name: string }) => {
    const params = { kind: "person" as const, id: person.id, name: person.name };
    go(
      { kind: "person", id: person.id },
      (nav) => nav.push("SearchBrowse", params),
      (nav) => nav.replace("SearchBrowse", params),
    );
  }, [go]);

  return useMemo(() => ({ openTitle, openPerson }), [openTitle, openPerson]);
}
