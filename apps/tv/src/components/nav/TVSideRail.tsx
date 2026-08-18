import { useCallback, useEffect, useRef, useState, memo } from "react";
import { View, Text, TVFocusGuideView, Platform, findNodeHandle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate } from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { useTentacleConfig, useJellyfinClient, useUserId, prefetchLibraryCatalog } from "@tentacle-tv/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RAIL, largeurIndiceRail } from "@tentacle-tv/tv-core";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { RailRow } from "./RailRow";
import { useRailEntries } from "./railEntries";
import { useEpinglageRail } from "./railPinning";
import { TentacleLogo } from "../icons/TentacleLogo";
import { useTVNav } from "../../context/TVNavContext";
import { Colors, Fonts } from "../../theme/colors";
import { Easings } from "../../theme/motion";

/** Largeur du rail replié — le contenu réserve cette marge, overscan compris. */
export const RAIL_COLLAPSED = RAIL.largeurRepli + TV_OVERSCAN_PT.x;
/** Largeur du panneau qui apparaît derrière. Le rail, lui, ne bouge pas. */
export const RAIL_EXPANDED = RAIL.largeurPanneau;

const LARGEUR_INDICE = largeurIndiceRail(TV_OVERSCAN_PT.x);

interface TVSideRailProps {
  currentRoute: string;
  onNavigate: (key: string) => void;
  /** Incrémenter pour redonner le focus à l'item actif (ex : Retour sur l'accueil). */
  grabFocusSignal?: number;
}

/**
 * Le rail de navigation, à la géométrie de la LG.
 *
 * **Le rail ne change jamais de largeur.** La version précédente l'animait de
 * 76 à 256 points, ce qui repoussait toutes les affiches dès que le focus
 * entrait dans le menu. Ici, un panneau posé DERRIÈRE le rail apparaît en fondu
 * d'opacité ; les icônes ne bougent pas d'un point, et la page non plus. Le
 * moteur de focus vient de calculer sa géométrie sur ces positions — si elles
 * bougeaient pendant la transition, il viserait des cases qui n'existent plus.
 *
 * Aucun fond au repos : le rail flotte au-dessus de l'affiche, et la lisibilité
 * des icônes vient du voile de la bannière elle-même.
 */
export const TVSideRail = memo(function TVSideRail({ currentRoute, onNavigate, grabFocusSignal }: TVSideRailProps) {
  const { t } = useTranslation("nav");
  const { storage } = useTentacleConfig();
  const { haut, bas } = useRailEntries();
  const epinglage = useEpinglageRail();
  const progress = useSharedValue(0);
  const focusCount = useRef(0);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef<View>(null);

  // Préchargement du catalogue au focus d'une bibliothèque, temporisé :
  // traverser le rail au D-pad ne doit pas précharger tout le serveur.
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

  const [activeNode, setActiveNode] = useState<View | null>(null);
  const { setRailActiveNode, railFocused, setRailFocused, lastContentNodeRef } = useTVNav();
  const [deploye, setDeploye] = useState(false);

  // Sélectionner, c'est QUITTER le rail : replier immédiatement, sans passer par
  // le délai de `scheduleCollapse` qui courrait avec la navigation instantanée.
  // Et remettre `lastContentNodeRef` à null, sinon l'écran d'arrivée
  // restaurerait le focus sur un nœud d'un AUTRE écran, déjà démonté.
  const handleSelect = useCallback((key: string) => {
    if (key === "RailShowAll") { epinglage.toutAfficher(); return; }
    lastContentNodeRef.current = null;
    if (collapseTimer.current) { clearTimeout(collapseTimer.current); collapseTimer.current = null; }
    focusCount.current = 0;
    setRailFocused(false);
    setDeploye(false);
    progress.value = withTiming(0, { duration: RAIL.duree, easing: Easings.out });
    onNavigate(key);
  }, [onNavigate, progress, setRailFocused, lastContentNodeRef, epinglage]);

  const setActiveItemRef = useCallback((node: View | null) => {
    (activeRef as React.MutableRefObject<View | null>).current = node;
    setActiveNode(node);
    setRailActiveNode(node);
  }, [setRailActiveNode]);

  const userName = (() => {
    try { return (JSON.parse(storage.getItem("tentacle_user") ?? "{}") as { Name?: string }).Name ?? ""; }
    catch { return ""; }
  })();

  useEffect(() => {
    if (grabFocusSignal) activeRef.current?.setNativeProps?.({ hasTVPreferredFocus: true });
  }, [grabFocusSignal]);

  // Pont de focus ANDROID entre les deux groupes : depuis la première entrée du
  // bas, HAUT doit atteindre la dernière du haut. La recherche géométrique
  // native préférait parfois un focusable de la PAGE et redescendait dans le
  // contenu. tvOS a ses propres ponts, montés côté contenu.
  const [lastTopHandle, setLastTopHandle] = useState<number | null>(null);
  const [firstBottomHandle, setFirstBottomHandle] = useState<number | null>(null);
  const captureLastTop = useCallback((n: View | null) => setLastTopHandle(n ? findNodeHandle(n) : null), []);
  const captureFirstBottom = useCallback((n: View | null) => setFirstBottomHandle(n ? findNodeHandle(n) : null), []);

  const expand = useCallback(() => {
    if (collapseTimer.current) { clearTimeout(collapseTimer.current); collapseTimer.current = null; }
    focusCount.current += 1;
    setRailFocused(true);
    setDeploye(true);
    progress.value = withTiming(1, { duration: RAIL.duree, easing: Easings.out });
  }, [progress, setRailFocused]);

  const scheduleCollapse = useCallback(() => {
    focusCount.current = Math.max(0, focusCount.current - 1);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    // Court délai : passer d'une entrée à l'autre ne doit pas replier le rail.
    collapseTimer.current = setTimeout(() => {
      if (focusCount.current <= 0) {
        setRailFocused(false);
        setDeploye(false);
        progress.value = withTiming(0, { duration: RAIL.duree, easing: Easings.out });
      }
    }, 30);
  }, [progress, setRailFocused]);

  // Opacité seule, partout : rien ne se redimensionne, donc rien à recalculer.
  const panelStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-RAIL.libelleDecalage, 0]) }],
  }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.62 }));

  const rendre = (
    item: (typeof haut)[number],
    pont?: { captureNode?: (n: View | null) => void; nextFocusUp?: number; nextFocusDown?: number },
  ) => (
    <RailRow
      key={item.key}
      item={item}
      active={currentRoute === item.key}
      deploye={deploye}
      labelStyle={labelStyle}
      onNavigate={handleSelect}
      onMasquer={epinglage.basculer}
      onExpand={expand}
      onCollapse={scheduleCollapse}
      schedulePrefetch={schedulePrefetch}
      cancelPrefetch={cancelPrefetch}
      setActiveRef={setActiveItemRef}
      captureNode={pont?.captureNode}
      nextFocusUp={pont?.nextFocusUp}
      nextFocusDown={pont?.nextFocusDown}
    />
  );

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: RAIL_COLLAPSED, zIndex: 100 }}
    >
      {/* Le panneau, DERRIÈRE le rail : il déborde largement à droite et s'y
          éteint, ce qui évite une arête verticale au milieu de l'affiche. */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", top: 0, left: 0, bottom: 0, width: RAIL_EXPANDED }, panelStyle]}
      >
        <LinearGradient
          colors={[Colors.bgDeep, Colors.bgDeep, "rgba(0,0,0,0.86)", "transparent"]}
          locations={[0, 0.62, 0.82, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <TVFocusGuideView
        trapFocusLeft
        autoFocus={Platform.OS === "ios"}
        destinations={Platform.OS === "ios" ? undefined : (!railFocused && activeNode ? [activeNode] : undefined)}
        style={{
          flex: 1,
          paddingLeft: TV_OVERSCAN_PT.x,
          paddingTop: TV_OVERSCAN_PT.y,
          paddingBottom: TV_OVERSCAN_PT.y,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", height: RAIL.hauteurMarque, paddingLeft: RAIL.retraitEntree }}>
          <TentacleLogo size={34} />
          <Animated.View style={[{ marginLeft: RAIL.ecartMarque }, labelStyle]} pointerEvents="none">
            <Text numberOfLines={1} style={{ color: Colors.textPrimary, fontSize: 20, fontFamily: Fonts.bold }}>
              {userName || "Tentacle TV"}
            </Text>
          </Animated.View>
        </View>

        {/* Le rail ne défile PAS (spec tv-core) : un ScrollView rognait les
            libellés posés en absolu, qui débordent volontairement du rail
            replié. Les entrées se compriment (flexShrink) jusqu'au plancher. */}
        <View style={{ flex: 1, overflow: "visible" }}>
          {haut.map((item, i) => rendre(item,
            Platform.OS === "android" && i === haut.length - 1
              ? { captureNode: captureLastTop, nextFocusDown: firstBottomHandle ?? undefined }
              : undefined))}
        </View>

        {bas.map((item, bi) => rendre(item,
          Platform.OS === "android" && bi === 0
            ? { captureNode: captureFirstBottom, nextFocusUp: lastTopHandle ?? undefined }
            : undefined))}

        {/* L'indice n'apparaît qu'avec le panneau : hors focus, il n'a personne
            à instruire, et il occuperait la place pour rien. */}
        <Animated.View pointerEvents="none" style={[{ width: LARGEUR_INDICE }, hintStyle]}>
          <Text style={{ color: Colors.textSecondary, fontSize: 15, lineHeight: 20 }}>
            {t("railHint")}
          </Text>
        </Animated.View>
      </TVFocusGuideView>
    </View>
  );
});
