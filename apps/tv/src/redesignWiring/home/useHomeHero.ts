import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { reasonToText, useCardToggles, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { cardPressOf, heroChevrons, heroShown, holdPanelOf, nextHeroIndex } from "@tentacle-tv/tv-core";
import type { HeroModel } from "../../redesign/hero/heroTypes";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useBeyondEdge } from "../../platform/tvos/focus/useBeyondEdge";
import { useHeroEdgeTrap } from "../../platform/tvos/screens/homeHero";
import { backdropUriOf } from "../cards/cardArtwork";
import { heroModelOf } from "../hero/heroModel";
import { prefetchImage, useHeroImageReady } from "./heroImageReady";
import { useHeroArts } from "./useHeroArts";
import { useHeroSources } from "./useHeroSources";
import { useHeroFocused } from "./useHeroFocused";
import { useHeroRotation } from "./useHeroRotation";

/**
 * La bannière de l'accueil : ses titres selon le mode que le compte a choisi
 * et que le serveur garde — reprise, sélection au hasard, titre fixe ou « Pour
 * vous », comme le web, le bureau et le mobile (`useHeroSources`, tv-core
 * `hero/heroSource.ts`). Elle est UNE cible (tv-core `hero/heroNav.ts`) :
 * DROITE au-delà de son bord, le titre suivant, en boucle ; GAUCHE, le
 * précédent — le focus y est retenu tant qu'il y en a un (`useHeroEdgeTrap`),
 * sur le premier GAUCHE va au rail. Elle tourne seule, en fondu, seulement à
 * l'écran SANS le focus (`useHeroRotation`, `useHeroFocused`). OK : la fiche
 * (tv-core `cardPress`) ; OK maintenu : le grand panneau (`cardHold`).
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
  /** Le premier héros attend son image (bornée) : l'écran se dit encore « en chargement ». */
  imagePending: boolean;
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
  actions: HomeHeroActions,
  /** Le héros est dans le champ (`HomeView`, `onHeroVisibleChange`). */
  inView: boolean,
): HomeHero {
  const { t } = useTranslation();
  // Les raisons d'une recommandation se disent dans l'espace `reco`, comme sur « Pour vous ».
  const { t: tReco } = useTranslation("reco");
  const client = useJellyfinClient();
  const { items, source, recoOf } = useHeroSources();
  const fromResume = source === "resume";

  const [index, setIndex] = useState(0);
  const safeIndex = items.length > 0 ? index % items.length : 0;
  const screenFocused = useIsFocused();
  const advance = useCallback(() => setIndex((i) => nextHeroIndex(i, items.length)), [items.length]);
  const retreat = useCallback(() => setIndex((i) => Math.max(0, (i % Math.max(1, items.length)) - 1)), [items.length]);
  const heroFocused = useHeroFocused(focus);
  useHeroRotation({ focus, count: items.length, index, shown: screenFocused && inView, heroFocused, onAdvance: advance });
  const chevrons = heroChevrons(safeIndex, items.length);
  // GAUCHE retenu dans la bannière tant qu'il y a un titre avant (sinon : le rail).
  useHeroEdgeTrap(focus, chevrons.back);

  // Les fonds en cache avant leur tour : le fondu n'attend pas le réseau.
  useEffect(() => {
    for (const item of items) {
      const uri = backdropUriOf(client, item);
      if (uri) void prefetchImage(uri);
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

  const hero = useMemo(() => {
    if (!current || !face) return null;
    const position = items.findIndex((item) => item.Id === current.Id);
    const reco = source === "reco" ? recoOf.get(current.Id) : undefined;
    return heroModelOf(client, t, {
      item: current,
      art: face,
      // « Pour vous » se dit comme sur sa page : l'accroche, et la raison du titre.
      kicker: fromResume ? t("common:resumeWatching") : reco ? t("reco:heroKicker") : undefined,
      reason: reco?.reasons.map((reason) => reasonToText(reason, tReco)).find((text): text is string => !!text),
      page: { index: position >= 0 ? position : safeIndex, count: items.length },
      inWatchlist: toggles.watchlist,
    });
  }, [client, t, tReco, current, face, fromResume, source, recoOf, items, safeIndex, toggles.watchlist]);

  // Des gestes STABLES, qui lisent l'état du moment : le héros ne se
  // redessine pas quand seule la lumière du fond change.
  const live = useRef({ current, face, toggles, actions, fromResume });
  live.current = { current, face, toggles, actions, fromResume };
  // OK sur la bannière : la fiche du titre (tv-core `cardPress`, la bannière est une source de carte).
  const onPrimary = useCallback(() => {
    const { current: item, actions: act, fromResume: resumed } = live.current;
    if (item && cardPressOf({ surface: "hero", fromResume: resumed }) === "detail") act.detail(item);
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
    // Le panneau du titre affiché, dans la forme de sa source (tv-core `cards/cardHold`).
    const panel = holdPanelOf({ surface: "hero", fromResume: resumed });
    if (item && panel?.kind === "media") act.sheet(item, panel.variant);
  }, []);

  const edgeKey = hero && items.length > 1 ? hero.primary.focusKey : null;
  useBeyondEdge(focus, { edgeKey, direction: "droite", enabled: screenFocused, onBeyond: advance });
  useBeyondEdge(focus, { edgeKey: chevrons.back ? edgeKey : null, direction: "gauche", enabled: screenFocused, onBeyond: retreat });

  // Son image d'abord : sans elle, le cadre du premier héros paraissait vide
  // et l'image tombait après les rangées (tv-core `homeLoading`).
  const imageReady = useHeroImageReady(hero !== null, hero?.backdropUri);

  return {
    hero,
    current,
    // La source du mode n'est pas connue, ou le premier titre attend son art.
    pending: source === null || (items.length > 0 && !hero),
    imagePending: hero !== null && !imageReady,
    onPrimary,
    onSecondary,
    onToggleList,
    onLongPress,
  };
}
