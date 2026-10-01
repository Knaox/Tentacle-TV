import { memo } from "react";
import { StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { usePresence } from "../motion/useMotion";
import type { IconName } from "../icons/Icon";
import { scrim, white } from "../theme/tokens";
import { Capsule, useUnfold } from "./NavCapsule";
import { NavItem } from "./NavItem";
import { NavLegend, type NavHint } from "./NavLegend";
import { NavList } from "./NavList";
import {
  ITEM_LEFT,
  LEGEND_TOP,
  LIST_HEIGHT,
  LIST_TOP,
  PROFILE_HEIGHT,
  PROFILE_PAD,
  PROFILE_TOP,
  RAIL_HEIGHT,
  RAIL_TOP,
  SEARCH_TOP,
  SEPARATOR_TOP,
} from "./navGeometry";

export type { NavHint } from "./NavLegend";

/**
 * La navigation : DEUX capsules de verre qui flottent à gauche, décollées des
 * bords, même largeur, un petit écart — le rail principal (Rechercher en tête,
 * puis Accueil, Pour vous, Ma liste, Favoris, chaque bibliothèque, « Tout
 * afficher » quand une entrée est masquée) et, dessous, la capsule du PROFIL
 * (le compte et ses réglages), fixe. Repliées, elles ne montrent que les
 * pictogrammes ; ouvertes (le focus y est), elles s'élargissent PAR-DESSUS le
 * contenu, sous un voile, avec leurs libellés et, en bas du rail, la légende
 * de ses touches.
 *
 * Le rail tient BEAUCOUP de bibliothèques : sa liste défile entre Rechercher
 * et la légende en suivant le focus (`NavList`), avec un fondu du côté où il
 * y a plus et un indicateur de position.
 *
 * L'organisation se voit ici, se décide à l'intégration : `heldKey` (le menu
 * d'appui long de cette entrée est ouvert), `movingKey` (on la déplace).
 *
 * Clés de focus : `nav:<entrée>` — `nav:Search`, `nav:Home`,
 * `nav:Library_<id>`, `nav:RailShowAll`, `nav:Settings` (le profil)…
 * La géométrie des capsules est dans `navGeometry.ts` : les ponts de focus
 * de l'intégration s'y posent.
 *
 * Le DÉPLIAGE (Apple TV) : la capsule s'élargit vraiment — son bord droit,
 * arrondi, avance sur le ressort `unfold` pendant que le verre dense remplace
 * le verre clair et que les libellés glissent en place ; au repli, il revient
 * plus vite. Sans animer de largeur : une fenêtre coupée glisse, son contenu
 * glisse en sens inverse (deux `translateX`), et la coupe n'existe que le
 * temps du mouvement — au repos, aucun masque à composer.
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

export interface NavRailProps {
  /** Rechercher : à part, en tête, fixe. */
  search: NavEntry;
  /** Ce qui défile : Accueil… les bibliothèques, « Tout afficher ». */
  entries: NavEntry[];
  /** La capsule du profil, en bas. */
  account: NavAccount;
  activeKey: string;
  expanded: boolean;
  /** La légende du rail ouvert : deux lignes courtes. */
  hints?: NavHint[];
  heldKey?: string | null;
  movingKey?: string | null;
  onSelect?: (key: string) => void;
  onLongPress?: (key: string) => void;
  onFocusChange?: (key: string, focused: boolean) => void;
}

const N = TV_STAGE.nav;

export const NavRail = memo(function NavRail({
  search,
  entries,
  account,
  activeKey,
  expanded,
  hints,
  heldKey,
  movingKey,
  onSelect,
  onLongPress,
  onFocusChange,
}: NavRailProps) {
  const { openness, moving } = useUnfold(expanded);
  const veil = usePresence(expanded, "veil");
  const veilFade = useAnimatedStyle(() => ({ opacity: veil.progress.value }));
  const width = expanded ? N.expandedWidth : N.collapsedWidth;
  const shared = { expanded, openness, onSelect, onLongPress, onFocusChange };
  return (
    <>
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
      <View pointerEvents="box-none" style={[styles.layer, { width: N.left + width }]}>
        <Capsule top={RAIL_TOP} height={RAIL_HEIGHT} width={width} openness={openness} clip={moving}>
          <View style={styles.search}>
            <NavItem itemKey={search.key} label={search.label} icon={search.icon} active={search.key === activeKey} {...shared} />
          </View>
          <View style={[styles.separator, { width: expanded ? N.expandedWidth - 60 : 44 }]} />
          <View style={styles.list}>
            <NavList entries={entries} activeKey={activeKey} heldKey={heldKey} movingKey={movingKey} {...shared} />
          </View>
          {expanded && hints?.length ? <NavLegend hints={hints} openness={openness} top={LEGEND_TOP} /> : null}
        </Capsule>
        <Capsule top={PROFILE_TOP} height={PROFILE_HEIGHT} width={width} openness={openness} clip={moving}>
          <View style={styles.profile}>
            <NavItem
              itemKey={account.key}
              label={account.label}
              caption={account.caption}
              avatarUri={account.avatarUri}
              initial={account.initial}
              active={account.key === activeKey}
              {...shared}
            />
          </View>
        </Capsule>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  // La région des capsules seulement (voir le voile, plus haut).
  layer: { position: "absolute", left: 0, top: 0, height: 1080 },
  veil: { position: "absolute", left: 0, top: 0, width: 1920, height: 1080 },
  search: { position: "absolute", top: SEARCH_TOP, left: ITEM_LEFT },
  separator: { position: "absolute", top: SEPARATOR_TOP, left: ITEM_LEFT + 10, height: 1, backgroundColor: white(0.12) },
  list: { position: "absolute", top: LIST_TOP, left: 0, right: 0, height: LIST_HEIGHT },
  profile: { position: "absolute", top: PROFILE_PAD, left: ITEM_LEFT },
});
