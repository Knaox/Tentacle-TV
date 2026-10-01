import { memo, useLayoutEffect, useRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import { motionTo } from "../motion/motion";
import { useEntrance, useMotion } from "../motion/useMotion";
import { colors, fonts, white } from "../theme/tokens";
import { RequestStateLine } from "./RequestStateLine";
import type { RequestItemModel } from "./requestTypes";

/**
 * Une demande de la liste, en LECTURE SEULE : l'affiche, le titre, l'année et
 * les saisons, puis où elle en est (`RequestStateLine`). OK n'y fait rien ; le
 * focus, quand l'intégration le permet (une longue liste), ne sert qu'à
 * faire défiler — d'où un focus discret : le verre s'éclaire, sans le blanc
 * d'un bouton.
 *
 * Mouvement : une demande arrivée SORT en douceur (`leaving` : elle s'efface,
 * infocalisable), puis les suivantes remontent à leur place ; une demande
 * nouvelle (`fresh`) entre en fondu. Transform et opacité seulement.
 */

export const ROW_HEIGHT = 148;
export const ROW_GAP = 12;
export const ROW_PITCH = ROW_HEIGHT + ROW_GAP;
const POSTER = { width: 88, height: 132 };

export const requestRowKey = (key: string) => `requests:row:${key}`;

export interface RequestRowProps {
  item: RequestItemModel;
  index: number;
  leaving: boolean;
  fresh: boolean;
}

export const RequestRow = memo(function RequestRow({ item, index, leaving, fresh }: RequestRowProps) {
  const reduced = useReducedMotion();
  const presence = useMotion(!leaving, "veil");
  const entrance = useEntrance("reveal");
  const arrival = fresh ? entrance : null;
  // Une demande retirée plus haut : on remonte d'où l'on était.
  const shift = useSharedValue(0);
  const lastIndex = useRef(index);
  useLayoutEffect(() => {
    const moved = lastIndex.current - index;
    lastIndex.current = index;
    if (moved === 0) return;
    shift.value = moved * ROW_PITCH;
    shift.value = motionTo(0, "focus", reduced);
  }, [index, reduced, shift]);
  const motion = useAnimatedStyle(() => {
    const shown = presence.value * (arrival ? arrival.value : 1);
    return { opacity: shown, transform: [{ translateY: shift.value }, { scale: 0.97 + 0.03 * shown }] };
  });
  return (
    <Animated.View style={motion}>
      <FocusTarget focusKey={requestRowKey(item.key)} form="row" disabled={leaving} accessibilityLabel={describe(item)}>
        {(focused) => <Body item={item} focused={focused} />}
      </FocusTarget>
    </Animated.View>
  );
});

function describe(item: RequestItemModel): string {
  return [item.title, item.detail, item.stateLabel, item.percentLabel].filter(Boolean).join(", ");
}

function Body({ item, focused }: { item: RequestItemModel; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lit = useAnimatedStyle(() => ({ opacity: p.value }));
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.012 * p.value }] }));
  return (
    <Animated.View style={[styles.row, lift]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.lit, lit]} />
      <View style={styles.poster}>
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
        ) : null}
      </View>
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        {item.detail ? <Text style={styles.detail} numberOfLines={1}>{item.detail}</Text> : null}
        <View style={styles.state}>
          <RequestStateLine item={item} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: white(0.05),
  },
  // Le focus d'une ligne qu'on ne fait que parcourir : le verre s'éclaire.
  lit: { borderRadius: 24, backgroundColor: white(0.1), borderWidth: 1, borderColor: white(0.22) },
  poster: { ...POSTER, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surface3 },
  texts: { flex: 1, gap: 6 },
  title: { ...fonts.bold, fontSize: 32, lineHeight: 38, color: colors.text },
  detail: { ...fonts.medium, fontSize: 24, color: colors.textTertiary },
  state: { marginTop: 6 },
});
