import { memo, useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { PREVIEW_ZONE_FADE, previewZoneShown } from "@tentacle-tv/tv-core";
import { CardHoldHint } from "../cards/CardHoldHint";
import { usePreviewZoneHero, usePreviewZoneState, usePreviewZoneStore, type PreviewZoneStore } from "../cards/trailerPreviewPort";
import { PillButton } from "../controls/PillButton";
import { RoundButton } from "../controls/RoundButton";
import type { HeroModel } from "../hero/heroTypes";
import { motionTo } from "../motion/motion";
import { Reveal } from "../motion/Reveal";
import { SWAP_FLOOR } from "../motion/useSwap";
import { colors, white } from "../theme/tokens";

/**
 * Les BOUTONS du héros de l'Accueil, dans la zone d'aperçu — Lecture ou
 * Reprendre, Plus d'infos, Ma liste : le titre mis en avant, son texte et son
 * fond, c'est la zone qui les dessine (`PreviewZoneView`). La page les pose
 * dans sa zone (`HeroZone`, dans sa section `section:hero`), au-dessus de son
 * calque, hors de la liste : rien ne les recouvre.
 *
 * Un bouton focalisé le dit à la zone (`usePreviewZoneHero`) : elle remet le
 * titre mis en avant. Quand une carte a la zone, les boutons s'effacent —
 * jusqu'à `SWAP_FLOOR`, invisibles mais encore focalisables : HAUT depuis la
 * première rangée y mène toujours (une opacité nulle les rendrait cachés pour
 * tvOS).
 */

export interface HeroZoneHeadProps {
  hero: HeroModel;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onToggleList?: () => void;
  onLongPress?: () => void;
  /** Le héros a la zone (ou la perd) : sa rotation s'y suspend. */
  onVisibleChange?: (visible: boolean) => void;
}

export const HeroZoneHead = memo(function HeroZoneHead(props: HeroZoneHeadProps) {
  return <HeroButtons {...props} store={usePreviewZoneStore()} />;
});

function useHeroHasZone(store: PreviewZoneStore | null): boolean {
  const state = usePreviewZoneStateOrNull(store);
  if (!state) return true;
  return previewZoneShown(state, { hasHero: true, fallbackId: null })?.kind === "hero";
}

function usePreviewZoneStateOrNull(store: PreviewZoneStore | null) {
  // Le crochet est toujours appelé : sans portée (le banc), une portée muette.
  return usePreviewZoneState(store ?? MUTE_STORE);
}

const MUTE_STATE = { subject: null, focused: false, since: null };
const MUTE_STORE: PreviewZoneStore = {
  getState: () => MUTE_STATE,
  getCard: () => null,
  subscribe: () => () => undefined,
  dispatch: () => undefined,
  refresh: () => undefined,
};

function HeroButtons({ hero, onPrimary, onSecondary, onToggleList, onLongPress, onVisibleChange, store }: HeroZoneHeadProps & { store: PreviewZoneStore | null }) {
  const [focused, setFocused] = useState(false);
  const onFocusChange = useCallback((on: boolean) => setFocused(on), []);
  usePreviewZoneHero(focused);
  const shown = useHeroHasZone(store) || focused;
  useEffect(() => onVisibleChange?.(shown), [shown, onVisibleChange]);
  const reduced = useReducedMotion();
  const opacity = useSharedValue(shown ? 1 : SWAP_FLOOR);
  useEffect(() => {
    opacity.value = motionTo(shown ? 1 : SWAP_FLOOR, PREVIEW_ZONE_FADE.textMs, reduced);
  }, [shown, opacity, reduced]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.row, fade]}>
      <PillButton variant="brand" {...hero.primary} onPress={onPrimary} onLongPress={onLongPress} onFocusChange={onFocusChange} />
      {hero.secondary ? (
        <PillButton variant="glass" {...hero.secondary} onPress={onSecondary} onLongPress={onLongPress} onFocusChange={onFocusChange} />
      ) : null}
      {hero.listToggle ? (
        <RoundButton
          icon="plus"
          activeIcon="check"
          label={hero.listToggle.label}
          active={hero.listToggle.active}
          focusKey={hero.listToggle.focusKey}
          onPress={onToggleList}
          onLongPress={onLongPress}
          onFocusChange={onFocusChange}
        />
      ) : null}
      {onLongPress ? (
        <Reveal shown={focused} style={styles.hold}>
          <CardHoldHint />
        </Reveal>
      ) : null}
      {hero.page && hero.page.count > 1 ? (
        <View style={styles.dots}>
          {Array.from({ length: hero.page.count }, (_, i) => (
            <View key={i} style={[styles.dot, i === hero.page!.index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

const DOT = 8;

const styles = StyleSheet.create({
  // La section qui la porte la place (`HeroZone`).
  row: { flex: 1, flexDirection: "row", alignItems: "center", gap: 18 },
  // « Maintenir OK », à droite des boutons : sous eux, la page commence.
  hold: { marginLeft: 10 },
  dots: { marginLeft: "auto", flexDirection: "row", gap: 10 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: white(0.4) },
  dotActive: { width: 34, backgroundColor: colors.text },
});
