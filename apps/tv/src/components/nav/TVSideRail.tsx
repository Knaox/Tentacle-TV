import { useCallback, useEffect, useRef, useState, memo } from "react";
import { View, Text, ScrollView, TVFocusGuideView, Platform } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { useLibraries, useTentacleConfig, useJellyfinClient, useUserId, prefetchLibraryCatalog } from "@tentacle-tv/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RailRow } from "./RailRow";
import { TentacleLogo } from "../icons/TentacleLogo";
import { possessiveLibraryName } from "../../utils/libraryLabel";
import { useTVScrollToFocused } from "../../hooks/useTVScrollToFocused";
import { useTVNav } from "../../context/TVNavContext";
import {
  HomeIcon, SearchIcon, LibraryIcon, SettingsIcon, InfoIcon,
  LogoutIcon, TVIcon, MusicIcon, BookIcon, ServerIcon,
} from "../icons/TVIcons";
import { Colors, Fonts } from "../../theme/colors";
import { Durations, Easings } from "../../theme/motion";

/** Largeur du rail replié (icônes seules) — le contenu réserve cette marge. */
export const RAIL_COLLAPSED = 76;
/** Largeur étendue au focus (icônes + libellés), façon Apple TV / Netflix. */
export const RAIL_EXPANDED = 256;

const ICON_SIZE = 22;

export interface RailItem {
  key: string;
  label: string;
  icon: (color: string) => React.ReactNode;
  danger?: boolean;
}

interface TVSideRailProps {
  currentRoute: string;
  onNavigate: (key: string) => void;
  /** Incrémenter pour redonner le focus à l'item actif (ex: BACK sur Accueil). */
  grabFocusSignal?: number;
}

function libraryIcon(collectionType?: string) {
  return (color: string) => {
    switch (collectionType?.toLowerCase()) {
      case "tvshows": return <TVIcon size={ICON_SIZE} color={color} />;
      case "music": return <MusicIcon size={ICON_SIZE} color={color} />;
      case "books": return <BookIcon size={ICON_SIZE} color={color} />;
      default: return <LibraryIcon size={ICON_SIZE} color={color} />;
    }
  };
}

/**
 * Rail de navigation persistant type tvOS : toujours visible en colonne
 * d'icônes, s'étend avec un panneau verre dépoli quand le focus y entre.
 */
export const TVSideRail = memo(function TVSideRail({ currentRoute, onNavigate, grabFocusSignal }: TVSideRailProps) {
  const { t, i18n } = useTranslation("nav");
  const { data: libraries } = useLibraries();
  const { storage } = useTentacleConfig();
  const progress = useSharedValue(0);
  const focusCount = useRef(0);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef<View>(null);
  // Le ScrollView des items du haut doit suivre le focus D-pad (sinon une
  // bibliothèque basse est focusée hors viewport).
  const itemsScrollRef = useRef<ScrollView>(null);
  const { makeOnFocus } = useTVScrollToFocused(itemsScrollRef, 56);

  // Prefetch du catalogue au focus d'une bibliothèque (debouncé : traverser le
  // rail au D-pad ne doit pas précharger toutes les bibliothèques). Mêmes
  // filtres que LibraryScreen → la grille s'affiche depuis le cache.
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  const userId = useUserId();
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePrefetch = useCallback((libraryId: string) => {
    if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
    prefetchTimer.current = setTimeout(() => {
      void prefetchLibraryCatalog(queryClient, jfClient, userId, libraryId, {
        sortBy: "DateCreated", sortOrder: "Descending", limit: 30, fields: "light",
      });
    }, 300);
  }, [queryClient, jfClient, userId]);
  const cancelPrefetch = useCallback(() => {
    if (prefetchTimer.current) { clearTimeout(prefetchTimer.current); prefetchTimer.current = null; }
  }, []);
  // Nœud de l'item actif pour TVFocusGuideView.destinations : entrer dans le
  // rail (LEFT depuis le contenu) focalise TOUJOURS l'item actif — sans ça,
  // Android choisit l'item géométriquement le plus proche (ex: Déconnexion !).
  const [activeNode, setActiveNode] = useState<View | null>(null);
  // Publie aussi le nœud actif au contexte : sur Apple TV, le pont de focus
  // (TVFocusBridgeLeft, monté côté contenu) l'utilise comme destination pour que
  // LEFT depuis le contenu atteigne le rail (overlay sibling, sinon injoignable
  // au D-pad sur tvOS). Additif — le `destinations` interne ci-dessous reste
  // utilisé tel quel (notamment Android).
  // `railFocused` est dans le contexte : le pont de focus tvOS (TVFocusBridgeLeft)
  // doit savoir si le focus est dans le rail pour se désactiver (sinon il piège).
  const { setRailActiveNode, railFocused, setRailFocused, lastContentNodeRef } = useTVNav();

  // Sélection d'un item = on QUITTE le rail pour le contenu. Replier IMMÉDIATEMENT (≠ le timer 30 ms de
  // scheduleCollapse, qui course avec la navigation instantanée `animation:"none"` → rail resté étendu +
  // focus piégé, surtout au retour Bibliothèque→Accueil). Et remettre `lastContentNodeRef=null` : sinon
  // l'écran cible restaurerait le focus sur une node d'un AUTRE écran (démontée) → focus mort → piégé ;
  // à null, l'écran cible retombe sur son `autoFocus` (TVFocusGuideView) → focus valide sur le contenu.
  const handleSelect = useCallback((key: string) => {
    lastContentNodeRef.current = null;
    if (collapseTimer.current) { clearTimeout(collapseTimer.current); collapseTimer.current = null; }
    focusCount.current = 0;
    setRailFocused(false);
    progress.value = withTiming(0, { duration: Durations.fast, easing: Easings.out });
    onNavigate(key);
  }, [onNavigate, progress, setRailFocused, lastContentNodeRef]);
  const setActiveItemRef = useCallback((node: View | null) => {
    (activeRef as React.MutableRefObject<View | null>).current = node;
    setActiveNode(node);
    setRailActiveNode(node);
  }, [setRailActiveNode]);
  // Redirection vers l'item actif UNIQUEMENT quand le focus vient de
  // l'extérieur : une fois dans le rail, la navigation interne (descendre
  // jusqu'à Déconnexion) ne doit pas être re-routée vers l'item actif.

  const userName = (() => {
    try { return (JSON.parse(storage.getItem("tentacle_user") ?? "{}") as { Name?: string }).Name ?? ""; }
    catch { return ""; }
  })();

  // BACK sur l'accueil → focus sur l'item actif du rail.
  useEffect(() => {
    if (grabFocusSignal) activeRef.current?.setNativeProps?.({ hasTVPreferredFocus: true });
  }, [grabFocusSignal]);

  const expand = useCallback(() => {
    if (collapseTimer.current) { clearTimeout(collapseTimer.current); collapseTimer.current = null; }
    focusCount.current += 1;
    setRailFocused(true);
    progress.value = withTiming(1, { duration: Durations.base, easing: Easings.out });
  }, [progress]);

  const scheduleCollapse = useCallback(() => {
    focusCount.current = Math.max(0, focusCount.current - 1);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    // Petit délai : le focus passe d'un item à l'autre sans replier le rail.
    collapseTimer.current = setTimeout(() => {
      if (focusCount.current <= 0) {
        setRailFocused(false);
        progress.value = withTiming(0, { duration: Durations.fast, easing: Easings.out });
      }
    }, 30);
  }, [progress]);

  const railStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [RAIL_COLLAPSED, RAIL_EXPANDED]),
  }));
  const panelStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-8, 0]) }],
  }));

  const items: RailItem[] = [
    { key: "Search", label: t("search"), icon: (c) => <SearchIcon size={ICON_SIZE} color={c} /> },
    { key: "Home", label: t("home"), icon: (c) => <HomeIcon size={ICON_SIZE} color={c} /> },
    ...(libraries ?? []).map((lib) => ({
      key: `Library_${lib.Id}`,
      label: possessiveLibraryName(lib.Name, i18n.language),
      icon: libraryIcon(lib.CollectionType),
    })),
  ];
  const bottomItems: RailItem[] = [
    { key: "Preferences", label: t("preferences"), icon: (c) => <SettingsIcon size={ICON_SIZE} color={c} /> },
    { key: "About", label: t("about"), icon: (c) => <InfoIcon size={ICON_SIZE} color={c} /> },
    { key: "ChangeServer", label: t("changeServer"), icon: (c) => <ServerIcon size={ICON_SIZE} color={c} /> },
    { key: "Logout", label: t("logout"), icon: (c) => <LogoutIcon size={ICON_SIZE} color={c} />, danger: true },
  ];

  const renderItem = (item: RailItem, index?: number) => (
    <RailRow
      key={item.key}
      item={item}
      index={index}
      active={currentRoute === item.key}
      labelStyle={labelStyle}
      onNavigate={handleSelect}
      onExpand={expand}
      onCollapse={scheduleCollapse}
      schedulePrefetch={schedulePrefetch}
      cancelPrefetch={cancelPrefetch}
      makeOnFocus={makeOnFocus}
      setActiveRef={setActiveItemRef}
    />
  );

  return (
    <Animated.View
      style={[{ position: "absolute", top: 0, left: 0, bottom: 0, zIndex: 100, overflow: "hidden" }, railStyle]}
    >
      {/* Panneau verre dépoli — n'apparaît qu'en mode étendu */}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, panelStyle]}>
        <View style={{ flex: 1, backgroundColor: Colors.glassBgHeavy, borderRightWidth: 1, borderRightColor: Colors.glassBorder }} />
      </Animated.View>
      {/* Liseré sombre permanent pour la lisibilité des icônes en mode replié */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.78)", "rgba(0,0,0,0)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: RAIL_COLLAPSED + 40 }}
      />

      {/*
        Android : `destinations` redirige l'entrée géométrique vers l'item actif.
        tvOS : `autoFocus` fait du rail un VRAI groupe de focus navigable (sans ça,
        on entre mais on ne peut pas se déplacer ni sortir) ; il mémorise le dernier
        item focusé. L'atterrissage sur l'item actif est géré par TVFocusBridgeLeft,
        donc pas de `destinations` ici sur tvOS (qui empêcherait la nav interne).
      */}
      {/* @ts-ignore — TVFocusGuideView props from react-native-tvos */}
      <TVFocusGuideView
        trapFocusLeft
        autoFocus={Platform.OS === "ios"}
        destinations={
          Platform.OS === "ios"
            ? undefined
            : (!railFocused && activeNode ? [activeNode] : undefined)
        }
        style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 24 }}
      >
        {/* Avatar utilisateur (décoratif) */}
        <View style={{ flexDirection: "row", alignItems: "center", height: 48, marginBottom: 16 }}>
          <View style={{ width: RAIL_COLLAPSED - 24, alignItems: "center" }}>
            <TentacleLogo size={30} />
          </View>
          <Animated.Text numberOfLines={1} style={[{ flex: 1, color: Colors.textSecondary, fontSize: 14, fontFamily: Fonts.semibold }, labelStyle]}>
            {userName || "Tentacle TV"}
          </Animated.Text>
        </View>

        <ScrollView ref={itemsScrollRef} showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {items.map((item, i) => renderItem(item, i))}
        </ScrollView>

        <View style={{ height: 1, backgroundColor: Colors.divider, marginVertical: 10 }} />
        {bottomItems.map((item) => renderItem(item))}
      </TVFocusGuideView>
    </Animated.View>
  );
});
