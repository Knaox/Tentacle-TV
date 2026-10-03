import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "react-native";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { useCardToggles, useFeaturedItems, useJellyfinClient, useSeriesWatchState } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { heroEdgeKey, heroItemsOf, heroShown, nextHeroIndex } from "@tentacle-tv/tv-core";
import type { HeroModel } from "../../redesign/hero/HeroBanner";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useBeyondEdge } from "../../platform/tvos/focus/useBeyondEdge";
import { backdropUriOf } from "../cards/cardArtwork";
import { heroModelOf } from "../hero/heroModel";
import { useHeroArts } from "./useHeroArts";
import { useHeroRotation } from "./useHeroRotation";

/**
 * Le héros de l'accueil : les visionnages à REPRENDRE d'abord (cinq au plus),
 * sinon une sélection au hasard du serveur — les règles de tv-core
 * (`hero/rotation.ts` : les titres, le suivant, le titre affiché, le bord). Il tourne seul, en fondu, même
 * focalisé — le minuteur repart à chaque geste, rien ne tourne hors champ
 * (`useHeroRotation`). Et on le tourne à la main : DROITE au-delà du dernier
 * bouton — clic sur le bord du pavé ou glisser, là où le focus ne va nulle
 * part, vers les points de la rotation — passe au titre suivant, en boucle,
 * un par geste (`useBeyondEdge`). Les boutons ne bougent pas : le focus
 * reste où il est.
 *
 * Un épisode se montre sous l'art de sa SÉRIE (logo, fond, genres), chargé
 * par sa fiche (`useMediaItem`, le cache de la page de détail : les gestes de
 * Ma liste y écrivent).
 */

export interface HomeHero {
  hero: HeroModel | null;
  /** L'item du héros affiché (lecture, fiche). */
  current: MediaItem | null;
  /** Des titres attendent le premier art : l'écran se dit « en chargement ». */
  pending: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
  onToggleList: () => void;
  /** L'appui maintenu sur un bouton : le grand panneau du titre affiché. */
  onLongPress: () => void;
}

export interface HomeHeroActions {
  play: (item: MediaItem) => void;
  detail: (item: MediaItem) => void;
  /** Le grand panneau d'un titre, dans la variante de sa carte : une reprise
   *  comme dans la rangée « Reprendre » (16:9), sinon une affiche. */
  sheet: (item: MediaItem, variant: "landscape" | "poster") => void;
}

export function useHomeHero(
  focus: FocusStore,
  resume: MediaItem[] | undefined,
  actions: HomeHeroActions,
  /** Le héros est dans le champ (`HomeView`, `onHeroVisibleChange`). */
  inView: boolean,
): HomeHero {
  const { t } = useTranslation();
  const client = useJellyfinClient();
  const featured = useFeaturedItems().data;
  const { items, fromResume } = useMemo(() => heroItemsOf(resume, featured), [resume, featured]);

  const [index, setIndex] = useState(0);
  const safeIndex = items.length > 0 ? index % items.length : 0;
  const screenFocused = useIsFocused();
  const advance = useCallback(() => setIndex((i) => nextHeroIndex(i, items.length)), [items.length]);
  useHeroRotation({ focus, count: items.length, index, shown: screenFocused && inView, onAdvance: advance });

  // Les fonds en cache avant leur tour : le fondu n'attend pas le réseau.
  useEffect(() => {
    for (const item of items) {
      const uri = backdropUriOf(client, item);
      if (uri) void Image.prefetch(uri);
    }
  }, [items, client]);

  const arts = useHeroArts(items);
  // Le titre AFFICHÉ : celui de la rotation dès que son art est là ; sinon le
  // précédent reste. Le titre ne s'écrit jamais en lettres pour céder ensuite
  // la place à son logo — et les boutons visent toujours ce qui est affiché.
  const candidate = items[safeIndex] ?? null;
  const shown = useRef<MediaItem | null>(null);
  shown.current = heroShown(shown.current, candidate, items.length, arts.settled);
  const current = shown.current;
  const face = current ? arts.artOf(current) ?? current : null;
  const toggles = useCardToggles(face ?? ({ Id: "" } as MediaItem));
  const isSeries = current?.Type === "Series";
  const { data: watchState } = useSeriesWatchState(isSeries ? current?.Id : undefined);

  const hero = useMemo(() => {
    if (!current || !face) return null;
    const position = items.findIndex((item) => item.Id === current.Id);
    return heroModelOf(client, t, {
      item: current,
      art: face,
      kicker: fromResume ? t("common:resumeWatching") : undefined,
      page: { index: position >= 0 ? position : safeIndex, count: items.length },
      inWatchlist: toggles.watchlist,
    });
  }, [client, t, current, face, fromResume, items, safeIndex, toggles.watchlist]);

  // Des gestes STABLES, qui lisent l'état du moment : le héros ne se
  // redessine pas quand seule la lumière du fond change.
  const live = useRef({ current, face, isSeries, watchState, toggles, actions, fromResume });
  live.current = { current, face, isSeries, watchState, toggles, actions, fromResume };
  const onPrimary = useCallback(() => {
    const { current: item, isSeries: series, watchState: state, actions: act } = live.current;
    if (!item) return;
    if (!series) return act.play(item);
    // Une série se lit par l'épisode à reprendre ; terminée, sa fiche s'ouvre.
    const episode = state && state.type !== "completed" ? state.episode : undefined;
    if (episode) act.play(episode);
    else act.detail(item);
  }, []);
  const onSecondary = useCallback(() => {
    const { current: item, actions: act } = live.current;
    if (item) act.detail(item);
  }, []);
  const onToggleList = useCallback(() => {
    if (live.current.face) live.current.toggles.toggleList();
  }, []);
  const onLongPress = useCallback(() => {
    const { current: item, actions: act, fromResume: resumed } = live.current;
    if (item) act.sheet(item, resumed ? "landscape" : "poster");
  }, []);

  useBeyondEdge(focus, {
    edgeKey: heroEdgeKey([hero?.primary.focusKey, hero?.secondary?.focusKey, hero?.listToggle?.focusKey], items.length),
    direction: "droite",
    enabled: screenFocused,
    onBeyond: advance,
  });

  return { hero, current, pending: items.length > 0 && !hero, onPrimary, onSecondary, onToggleList, onLongPress };
}
