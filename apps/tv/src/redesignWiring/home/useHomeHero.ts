import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "react-native";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { useCardToggles, useFeaturedItems, useJellyfinClient, useSeriesWatchState } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import type { HeroModel } from "../../redesign/hero/HeroBanner";
import { backdropUriOf } from "../cards/cardArtwork";
import type { FocusStore } from "../focus/focusStore";
import { heroModelOf } from "../hero/heroModel";
import { HERO_MAX_ITEMS, useHeroArts } from "./useHeroArts";

/**
 * Le héros de l'accueil : les visionnages à REPRENDRE d'abord (cinq au plus),
 * sinon une sélection au hasard du serveur. Il tourne toutes les huit
 * secondes — seulement écran affiché, et jamais pendant qu'un de ses boutons
 * a le focus : on ne change pas le titre sous le doigt de celui qui le lit.
 *
 * Un épisode se montre sous l'art de sa SÉRIE (logo, fond, genres), chargé
 * par sa fiche (`useMediaItem`, le cache de la page de détail : les gestes de
 * Ma liste y écrivent).
 */

const ROTATE_MS = 8_000;

export interface HomeHero {
  hero: HeroModel | null;
  /** L'item du héros affiché (lecture, fiche). */
  current: MediaItem | null;
  /** Des titres attendent le premier art : l'écran se dit « en chargement ». */
  pending: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
  onToggleList: () => void;
}

/** Vrai tant qu'un bouton du héros a le focus. */
function useHeroFocused(focus: FocusStore): boolean {
  const [focused, setFocused] = useState(false);
  useEffect(
    () =>
      focus.subscribe((key, isFocused) => {
        if (key.startsWith("hero:")) setFocused(isFocused || (focus.focusedKey()?.startsWith("hero:") ?? false));
      }),
    [focus],
  );
  return focused;
}

export function useHomeHero(
  focus: FocusStore,
  resume: MediaItem[] | undefined,
  actions: { play: (item: MediaItem) => void; detail: (item: MediaItem) => void },
): HomeHero {
  const { t } = useTranslation();
  const client = useJellyfinClient();
  const featured = useFeaturedItems().data;
  const fromResume = !!resume && resume.length > 0;
  const items = useMemo(() => (fromResume ? resume!.slice(0, HERO_MAX_ITEMS) : (featured ?? []).slice(0, HERO_MAX_ITEMS)), [fromResume, resume, featured]);

  const [index, setIndex] = useState(0);
  const safeIndex = items.length > 0 ? index % items.length : 0;
  const heroFocused = useHeroFocused(focus);
  const screenFocused = useIsFocused();
  useEffect(() => {
    if (items.length <= 1 || !screenFocused || heroFocused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [items.length, screenFocused, heroFocused]);

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
  if (items.length === 0) shown.current = null;
  else if (candidate && arts.settled(candidate)) shown.current = candidate;
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
  const live = useRef({ current, face, isSeries, watchState, toggles, actions });
  live.current = { current, face, isSeries, watchState, toggles, actions };
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

  return { hero, current, pending: items.length > 0 && !hero, onPrimary, onSecondary, onToggleList };
}
