import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { useFocusProgress } from "../../focus/useFocusProgress";
import type { IconName } from "../../icons/Icon";
import { CountdownPill } from "./CountdownPill";
import type { SkipPillModel } from "./playerTypes";
import { SOFT_BASE } from "./surfaces";

/**
 * La pilule de saut, en bas à droite : un passage à sauter (intro, résumé,
 * aperçu, générique, post-générique), la fin d'un film, ou « Aller à
 * l'épisode suivant ». Manuelle, elle se contente de se proposer ; quand elle
 * part toute seule, son anneau ambre décompte et « Masquer » l'accompagne
 * (c'est lui que l'intégration focalise). Mise en sourdine, elle ne reparaît
 * qu'avec l'habillage, sans « Masquer ».
 *
 * Habillage visible : elle MONTE au-dessus de la frise (en `transform`,
 * jamais en position). Clés : `player:skip`, `player:skip-dismiss` ; groupe
 * `player:skip-island` — les deux boutons, que l'intégration peut tenir
 * ensemble pendant un décompte et d'où elle ressort vers les commandes.
 */

const ICON: Record<SkipPillModel["kind"], IconName> = {
  segment: "fastForward",
  end: "logout",
  next: "skipNext",
};

/** Ce qui sépare la pilule posée de la pilule relevée au-dessus de la frise. */
const RAISE = 176;

export const SkipPill = memo(function SkipPill({
  model,
  raised,
  dismissLabel,
  onSkip,
  onDismiss,
}: {
  model: SkipPillModel;
  raised: boolean;
  dismissLabel: string;
  onSkip?: () => void;
  onDismiss?: () => void;
}) {
  const lift = useFocusProgress(raised, 200);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -RAISE * lift.value }] }));
  return (
    <Animated.View style={[styles.anchor, style]} pointerEvents="box-none">
      <FocusGroup focusKey="player:skip-island" style={styles.island} pointerEvents="box-none">
        <CountdownPill label={model.label} icon={ICON[model.kind]} countdown={model.countdown} base={SOFT_BASE} focusKey="player:skip" onPress={onSkip} />
        {model.refusable ? (
          <View style={styles.base}>
            <PillButton variant="glass" label={dismissLabel} focusKey="player:skip-dismiss" onPress={onDismiss} />
          </View>
        ) : null}
      </FocusGroup>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    right: TV_STAGE.safe.x,
    bottom: TV_STAGE.safe.y + 54,
  },
  island: { flexDirection: "row", alignItems: "center", gap: 18 },
  base: { borderRadius: 34, backgroundColor: SOFT_BASE },
});
