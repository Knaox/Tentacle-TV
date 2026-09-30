import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { railMaxOffset, railRevealOffset } from "@tentacle-tv/tv-core";
import { useForcedFocusKey } from "../focus/focusPreview";
import { FADE_DISTANCE, ITEM_LEFT, LIST_GEOMETRY, LIST_HEIGHT, PITCH } from "./navGeometry";
import { NavItem, type NavItemMode } from "./NavItem";
import type { NavEntry } from "./NavRail";
import { NavScrollIndicator } from "./NavScrollIndicator";

/**
 * La liste de la navigation, entre Rechercher (fixe, en tête) et la légende :
 * elle DÉFILE quand les entrées dépassent la hauteur — vingt bibliothèques et
 * plus — en suivant le focus, taillée pour la télécommande :
 *
 * - l'entrée focalisée est toujours entière et lisible, jamais au ras du
 *   bord : une voisine entière reste visible au-delà (`railRevealOffset`),
 *   que le moteur de focus trouve au prochain appui ;
 * - un fondu en haut et en bas dit qu'il y a plus — seulement du côté où il
 *   y a plus ; il estompe le DESSIN des entrées (opacité, sur le fil de
 *   l'interface), jamais un calque posé dessus, qui masquerait les cibles au
 *   moteur de focus ;
 * - l'indicateur de position, discret, replié comme déplié ;
 * - repliée, la liste montre l'entrée de la page courante.
 *
 * Ce n'est pas une décision de focus — on ne dit jamais OÙ il va — seulement
 * ce que la liste montre quand il y est (cf. `useSectionAnchors`). Au banc, la
 * clé figée est montrée de la même façon, sans animation.
 *
 * Les entrées sont rendues par POSITION (`slot:<i>`), pas par clé : réordonner
 * change ce qu'affiche une case, jamais la vue native qui porte le focus. Une
 * entrée déplacée ne perd donc pas le focus en route.
 */

export interface NavListProps {
  entries: NavEntry[];
  activeKey: string;
  expanded: boolean;
  openness: SharedValue<number>;
  heldKey?: string | null;
  movingKey?: string | null;
  onSelect?: (key: string) => void;
  onLongPress?: (key: string) => void;
  onFocusChange?: (key: string, focused: boolean) => void;
}

const G = LIST_GEOMETRY;
/** Le côté du fondu ne s'allume qu'une fois la liste décollée de ce bord. */
const EDGE_ON = PITCH / 2;

export const NavList = memo(function NavList(props: NavListProps) {
  const { entries, activeKey, expanded, heldKey, movingKey, onFocusChange } = props;
  const count = entries.length;
  const max = railMaxOffset(count, G);
  const forced = useForcedFocusKey();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  // L'entrée active visible dès le premier rendu (repliée, c'est elle qu'on montre).
  const initial = useMemo(
    () => railRevealOffset(entries.findIndex((entry) => entry.key === activeKey), 0, count, G),
    // Au montage seulement : la suite passe par `reveal`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const scrollY = useSharedValue(initial);
  const offset = useRef(initial);
  const keys = useRef(entries.map((entry) => entry.key));
  keys.current = entries.map((entry) => entry.key);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const remember = useCallback((y: number) => {
    offset.current = y;
  }, []);
  useAnimatedReaction(
    () => scrollY.value,
    (y, previous) => {
      if (y !== previous) runOnJS(remember)(y);
    },
  );

  const reveal = useCallback(
    (key: string | null | undefined, animated: boolean) => {
      const index = key ? keys.current.indexOf(key) : -1;
      if (index < 0) return;
      const next = railRevealOffset(index, offset.current, keys.current.length, G);
      if (Math.abs(next - offset.current) < 1) return;
      offset.current = next;
      scrollRef.current?.scrollTo({ y: next, animated });
    },
    [scrollRef],
  );

  const handleFocus = useCallback(
    (key: string, focused: boolean) => {
      onFocusChange?.(key, focused);
      if (focused && forced === null) reveal(key, true);
    },
    [onFocusChange, forced, reveal],
  );

  // Au banc : la clé figée, montrée sans animation.
  const forcedEntry = forced?.startsWith("nav:") ? forced.slice(4) : null;
  useEffect(() => {
    if (forcedEntry) reveal(forcedEntry, false);
  }, [forcedEntry, reveal]);
  // Repliée : l'entrée de la page courante reste en vue.
  useEffect(() => {
    if (!expanded && forced === null) reveal(activeKey, true);
  }, [expanded, activeKey, forced, reveal]);
  // Le menu d'une entrée, ou l'entrée qu'on déplace : suivis où qu'ils aillent.
  const followed = heldKey ?? movingKey ?? null;
  const followedIndex = followed ? entries.findIndex((entry) => entry.key === followed) : -1;
  useEffect(() => {
    if (followedIndex >= 0) reveal(followed, true);
  }, [followed, followedIndex, reveal]);

  return (
    <>
      <NavScrollIndicator count={count} openness={props.openness} scrollY={scrollY} />
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.content}
        contentOffset={{ x: 0, y: initial }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {entries.map((entry, index) => (
          <ListItem
            key={`slot:${index}`}
            index={index}
            entry={entry}
            max={max}
            scrollY={scrollY}
            active={entry.key === activeKey}
            mode={entry.key === movingKey ? "moving" : entry.key === heldKey ? "held" : null}
            expanded={expanded}
            openness={props.openness}
            onSelect={props.onSelect}
            onLongPress={props.onLongPress}
            onFocusChange={handleFocus}
          />
        ))}
      </Animated.ScrollView>
    </>
  );
});

interface ListItemProps extends Pick<NavListProps, "expanded" | "openness" | "onSelect" | "onLongPress"> {
  index: number;
  entry: NavEntry;
  max: number;
  scrollY: SharedValue<number>;
  active: boolean;
  mode: NavItemMode | null;
  onFocusChange: (key: string, focused: boolean) => void;
}

/** Une case de la liste : son entrée, et son fondu près d'un bord qui cache la suite. */
const ListItem = memo(function ListItem({ index, entry, max, scrollY, active, mode, onFocusChange, ...item }: ListItemProps) {
  const center = G.padTop + index * PITCH + G.item / 2;
  const fade = useAnimatedStyle(() => {
    const y = scrollY.value;
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const at = center - y;
    const above = clamp01(y / EDGE_ON);
    const below = clamp01((max - y) / EDGE_ON);
    const top = 1 - above * (1 - clamp01(at / FADE_DISTANCE));
    const bottom = 1 - below * (1 - clamp01((LIST_HEIGHT - at) / FADE_DISTANCE));
    return { opacity: top * bottom };
  });
  return (
    <NavItem
      itemKey={entry.key}
      label={entry.label}
      icon={entry.icon}
      active={active}
      expanded={item.expanded}
      openness={item.openness}
      mode={mode}
      fade={fade}
      onSelect={item.onSelect}
      onLongPress={item.onLongPress}
      onFocusChange={onFocusChange}
    />
  );
});

const styles = StyleSheet.create({
  list: { position: "absolute", left: 0, right: 0, top: 0, height: LIST_HEIGHT },
  content: { paddingTop: G.padTop, paddingBottom: G.padBottom, paddingLeft: ITEM_LEFT, gap: PITCH - G.item, alignItems: "flex-start" },
});
