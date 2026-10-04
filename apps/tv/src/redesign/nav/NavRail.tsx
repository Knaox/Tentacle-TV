import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { railMaxOffset } from "@tentacle-tv/tv-core";
import { usePresence } from "../motion/useMotion";
import type { IconName } from "../icons/Icon";
import { scrim, white } from "../theme/tokens";
import { Capsule, useUnfold } from "./NavCapsule";
import { NavFrameContext, type NavFrame } from "./navFrame";
import {
  COLLAPSED_WIDTH,
  ITEM,
  ITEM_INSET,
  LABEL_GAP,
  LIST_TOP,
  MARGIN_BOTTOM,
  RAIL_LEFT,
  SEARCH_TOP,
  SEPARATOR_TOP,
  expandedItemWidth,
  listEntryCenter,
  listGeometry,
  navExpandedWidth,
  navLayout,
  railGeometryOf,
  type NavRailGeometry,
  type NavTextWidths,
} from "./navGeometry";
import { NavItem } from "./NavItem";
import { NavLegend, type NavHint } from "./NavLegend";
import { NavList } from "./NavList";
import { NavOrganizeHint } from "./NavOrganizeHint";
import { NavSwitcherItem } from "./NavSwitcherItem";
import type { StackProfile } from "./ProfileStack";
import { NavTextMeasure } from "./NavTextMeasure";

export type { NavHint } from "./NavLegend";
export type { StackProfile } from "./ProfileStack";
export type { NavRailGeometry } from "./navGeometry";

/**
 * La navigation : DEUX capsules de verre qui flottent à gauche et ÉPOUSENT
 * leur contenu (`navGeometry.ts`) —
 *
 * - le bloc des PAGES : Rechercher en tête, puis Accueil, Pour vous, Ma
 *   liste, Favoris, chaque bibliothèque, « Tout afficher » quand une entrée
 *   est masquée. Haut comme ses entrées, CENTRÉ sur la hauteur de l'écran ;
 *   avec beaucoup de bibliothèques, jamais plus haut que le rail d'avant, et
 *   sa liste défile en suivant le focus (`NavList`), avec un fondu du côté où
 *   il y a plus et un indicateur de position ;
 * - le bloc du PROFIL, ancré en bas : le compte et ses réglages ; au-dessus,
 *   « Changer de profil » sur une Apple TV passée aux profils (`switcher`,
 *   l'empilement des profils de la famille) et, plus haut, l'élément des
 *   demandes en cours quand il existe (`accessory`). Jamais caché ni poussé
 *   hors de l'écran : c'est le bloc des pages qui cède.
 *
 * Repliées, une bande d'icônes en pilule ; ouvertes (le focus y est), elles
 * s'élargissent PAR-DESSUS le contenu, sous un voile, avec leurs libellés —
 * à la largeur de leur intitulé le plus long, mesurée (`NavTextMeasure`) et
 * bornée. Pendant un déplacement, à droite du profil, la bulle qui en dit les
 * touches (`NavLegend`) ; sinon, au plus, « Maintenir OK : organiser » à côté
 * de l'entrée focalisée (`NavOrganizeHint`), quand l'intégration le dit.
 *
 * L'organisation se voit ici, se décide à l'intégration : `heldKey` (le menu
 * d'appui long de cette entrée est ouvert), `movingKey` (on la déplace).
 *
 * Clés de focus : `nav:<entrée>` — `nav:Search`, `nav:Home`,
 * `nav:Library_<id>`, `nav:RailShowAll`, `nav:SwitchProfile`, `nav:Settings` (le profil)…
 * Les ponts de focus de l'intégration se posent sur la géométrie que la vue
 * publie (`onGeometry`).
 *
 * Le DÉPLIAGE (Apple TV) : la capsule s'élargit vraiment — son bord droit,
 * arrondi, avance sur le ressort `unfold` pendant que le verre dense remplace
 * le verre clair et que les libellés glissent en place ; au repli, il revient
 * plus vite. Sans animer de largeur ni de position : une fenêtre coupée glisse,
 * son contenu glisse en sens inverse (deux `translateX`), et la coupe n'existe
 * que le temps du mouvement — au repos, aucun masque à composer.
 */

export interface NavEntry {
  key: string;
  label: string;
  icon: IconName;
}

/** L'entrée du profil : le portrait (sinon l'initiale), le nom, et dessous ce qu'on y trouve. */
export interface NavAccount {
  key: string;
  label: string;
  caption?: string;
  avatarUri?: string;
  initial?: string;
}

/** « Changer de profil » (Famille) : juste au-dessus du profil, l'empilement des profils de la famille. */
export interface NavSwitcher {
  key: string;
  label: string;
  profiles: StackProfile[];
}

/**
 * Ce qui se pose au-dessus du profil, dans sa capsule — l'élément des
 * demandes en cours (Vigie). Sa hauteur est réservée par la géométrie (64 :
 * celle d'une entrée ; bornée à `ACCESSORY_MAX`) ; il lit l'état du rail par
 * `useNavFrame`.
 */
export interface NavAccessory {
  height: number;
  node: ReactNode;
}

export interface NavRailProps {
  /** Rechercher : à part, en tête, fixe. */
  search: NavEntry;
  /** Ce qui défile : Accueil… les bibliothèques, « Tout afficher ». */
  entries: NavEntry[];
  /** La capsule du profil, en bas. */
  account: NavAccount;
  /** Au-dessus du profil, dans sa capsule. */
  accessory?: NavAccessory | null;
  activeKey: string;
  expanded: boolean;
  /** « Changer de profil », au-dessus du profil ; absent hors Famille. */
  switcher?: NavSwitcher | null;
  /** La légende du rail ouvert — seulement pendant un déplacement, ses touches. */
  hints?: NavHint[];
  /** « Maintenir OK : organiser », à côté de l'entrée qu'elle concerne — quand l'intégration le dit. */
  organizeHint?: { entryKey: string; label: string } | null;
  heldKey?: string | null;
  movingKey?: string | null;
  onSelect?: (key: string) => void;
  onLongPress?: (key: string) => void;
  onFocusChange?: (key: string, focused: boolean) => void;
  /** Rappelé à chaque changement de géométrie (bibliothèques, langue, élément du profil). */
  onGeometry?: (geometry: NavRailGeometry) => void;
}

/** Entre le rail ouvert et sa légende. */
const LEGEND_GAP = 20;

/** Le filet sous Rechercher : en retrait des bords de la capsule. */
const SEPARATOR_INSET = 24;

const sameWidths = (a: NavTextWidths | null, b: NavTextWidths) => !!a && a.label === b.label && a.caption === b.caption;

export const NavRail = memo(function NavRail(props: NavRailProps) {
  const { search, entries, account, accessory, switcher, activeKey, expanded, hints, organizeHint, heldKey, movingKey, onGeometry } = props;
  const { onSelect, onLongPress, onFocusChange } = props;
  const { openness, moving } = useUnfold(expanded);
  const veil = usePresence(expanded, "veil");
  const veilFade = useAnimatedStyle(() => ({ opacity: veil.progress.value }));

  const accessoryHeight = accessory?.height ?? 0;
  const hasSwitcher = !!switcher;
  const layout = useMemo(
    () => navLayout({ count: entries.length, accessoryHeight, switcher: hasSwitcher }),
    [entries.length, accessoryHeight, hasSwitcher],
  );
  const listScroll = useSharedValue(0);
  const scrolls = railMaxOffset(entries.length, listGeometry(layout.viewport)) > 0;
  const [widths, setWidths] = useState<NavTextWidths | null>(null);
  const onMeasure = useCallback((next: NavTextWidths) => setWidths((previous) => (sameWidths(previous, next) ? previous : next)), []);
  const expandedWidth = navExpandedWidth(widths, scrolls);
  const width = expanded ? expandedWidth : COLLAPSED_WIDTH;
  const openItemWidth = expandedItemWidth(expandedWidth, scrolls);
  // Les libellés restent le temps du repli : ils s'effacent avec le verre.
  const labels = expanded || moving;
  const frame = useMemo<NavFrame>(
    () => ({
      expanded,
      openness,
      itemWidth: expanded ? openItemWidth : ITEM,
      labels,
      labelWidth: openItemWidth - ITEM - LABEL_GAP,
    }),
    [expanded, openness, openItemWidth, labels],
  );

  useEffect(() => {
    onGeometry?.(railGeometryOf(layout, expandedWidth));
  }, [onGeometry, layout, expandedWidth]);

  const switcherLabel = switcher?.label;
  const texts = useMemo(
    () => [search.label, ...entries.map((entry) => entry.label), ...(switcherLabel ? [switcherLabel] : []), account.label],
    [search.label, entries, switcherLabel, account.label],
  );
  const hintIndex = organizeHint ? entries.findIndex((entry) => entry.key === organizeHint.entryKey) : -1;
  const captions = useMemo(() => (account.caption ? [account.caption] : []), [account.caption]);

  const item = { onSelect, onLongPress, onFocusChange };
  return (
    <NavFrameContext.Provider value={frame}>
      {/* Une vue plein écran posée sur le contenu — la couche de la barre
          comme ce voile, même transparents — empêche le moteur de focus de
          tvOS d'y entrer (mesuré au simulateur). Le voile n'existe donc que
          barre ouverte ; l'intégration mène alors du rail au contenu. */}
      {veil.mounted ? (
        <Animated.View pointerEvents="none" style={[styles.veil, veilFade]}>
          <LinearGradient
            colors={[scrim(0.82), scrim(0.55), scrim(0)]}
            locations={[0, 0.3, 0.62]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      <View pointerEvents="box-none" style={[styles.layer, { width: RAIL_LEFT + width }]}>
        <Capsule
          top={layout.strip.top}
          height={layout.strip.height}
          width={width}
          expandedWidth={expandedWidth}
          openness={openness}
          clip={moving}
        >
          <View style={styles.search}>
            <NavItem itemKey={search.key} label={search.label} icon={search.icon} active={search.key === activeKey} {...item} />
          </View>
          <View style={[styles.separator, { width: expanded ? expandedWidth - SEPARATOR_INSET * 2 : COLLAPSED_WIDTH - SEPARATOR_INSET * 2 }]} />
          <View style={[styles.list, { height: layout.viewport }]}>
            <NavList
              entries={entries}
              viewport={layout.viewport}
              expandedWidth={expandedWidth}
              activeKey={activeKey}
              heldKey={heldKey}
              movingKey={movingKey}
              scrollY={listScroll}
              {...item}
            />
          </View>
        </Capsule>
        <Capsule
          top={layout.bottom.top}
          height={layout.bottom.height}
          width={width}
          expandedWidth={expandedWidth}
          openness={openness}
          clip={moving}
        >
          {accessory && layout.accessory ? (
            <View style={[styles.accessory, { top: layout.accessory.top, height: layout.accessory.height, width: frame.itemWidth }]}>
              {accessory.node}
            </View>
          ) : null}
          {switcher && layout.switcherTop !== null ? (
            <View style={[styles.profile, { top: layout.switcherTop }]}>
              <NavSwitcherItem switcher={switcher} {...item} />
            </View>
          ) : null}
          <View style={[styles.profile, { top: layout.profileTop }]}>
            <NavItem
              itemKey={account.key}
              label={account.label}
              caption={account.caption}
              avatarUri={account.avatarUri}
              initial={account.initial}
              active={account.key === activeKey}
              {...item}
            />
          </View>
        </Capsule>
      </View>
      {/* Rail ouvert, et le temps qu'il se replie (elle s'efface avec lui) :
          elle passe sur le contenu, jamais pendant que le focus y navigue. */}
      {hints?.length && labels ? (
        <NavLegend hints={hints} openness={openness} left={RAIL_LEFT + expandedWidth + LEGEND_GAP} bottom={MARGIN_BOTTOM} />
      ) : null}
      {organizeHint && hintIndex >= 0 && expanded ? (
        <NavOrganizeHint
          key={organizeHint.entryKey}
          label={organizeHint.label}
          center={listEntryCenter(layout, hintIndex)}
          left={RAIL_LEFT + expandedWidth + LEGEND_GAP}
          scrollY={listScroll}
        />
      ) : null}
      <NavTextMeasure labels={texts} captions={captions} onMeasure={onMeasure} />
    </NavFrameContext.Provider>
  );
});

const styles = StyleSheet.create({
  // La région des capsules seulement (voir le voile, plus haut).
  layer: { position: "absolute", left: 0, top: 0, height: 1080 },
  veil: { position: "absolute", left: 0, top: 0, width: 1920, height: 1080 },
  search: { position: "absolute", top: SEARCH_TOP, left: ITEM_INSET },
  separator: { position: "absolute", top: SEPARATOR_TOP, left: SEPARATOR_INSET, height: 1, backgroundColor: white(0.12) },
  list: { position: "absolute", top: LIST_TOP, left: 0, right: 0 },
  accessory: { position: "absolute", left: ITEM_INSET },
  profile: { position: "absolute", left: ITEM_INSET },
});
