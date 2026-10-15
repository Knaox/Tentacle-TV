import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon } from "../../icons/Icon";
import { pressScale, usePressProgress } from "../../motion/pressProgress";
import { DropShadow } from "../../render/DropShadow";
import { colors, fonts, text, white } from "../../theme/tokens";
import { ProfileAvatar } from "../profiles/ProfileAvatar";
import type { RailSetupTarget } from "./railSetupTypes";

/**
 * Un profil de l'étape du propriétaire : son rond, son nom, « Déjà
 * configuré » s'il a déjà sa barre ici — et la COCHE, en haut à droite du
 * rond : pleine à la couleur de la marque quand il est coché, un cercle vide
 * sinon. Au focus, comme sur « Qui regarde ? » : le rond grandit et s'élève,
 * le nom s'allume — jamais d'anneau.
 */

const AVATAR = 168;
export const APPLY_TILE_WIDTH = 230;
const FOCUS_SCALE = 1.1;
const CHECK = 50;

export const ApplyProfileTile = memo(function ApplyProfileTile({ target, focusKey, disabled, onPress }: {
  target: RailSetupTarget;
  focusKey: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const { t } = useTranslation("nav");
  const details = [t(target.selected ? "railSetup.selected" : "railSetup.notSelected"), target.setupDone ? t("railSetup.alreadySet") : null];
  return (
    <FocusTarget
      focusKey={focusKey}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={[target.name, ...details.filter(Boolean)].join(", ")}
    >
      {(focused) => <Body target={target} focused={focused} alreadySet={t("railSetup.alreadySet")} />}
    </FocusTarget>
  );
});

function Body({ target, focused, alreadySet }: { target: RailSetupTarget; focused: boolean; alreadySet: string }) {
  const p = useFocusProgress(focused);
  const press = usePressProgress();
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: -8 * p.value }, { scale: (1 + (FOCUS_SCALE - 1) * p.value) * pressScale(press ? press.value : 0) }],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <View style={styles.tile}>
      <Animated.View style={lift}>
        <Animated.View style={[styles.glow, glow]}>
          <DropShadow of={styles.glow} />
        </Animated.View>
        <ProfileAvatar name={target.name} color={target.color} uri={target.avatarUri} size={AVATAR} />
        <View style={[styles.check, target.selected ? styles.checkOn : styles.checkOff]}>
          {target.selected ? <Icon name="check" size={28} color={colors.onAccent} strokeWidth={3} /> : null}
        </View>
      </Animated.View>
      <Text style={[styles.name, { color: focused ? colors.text : colors.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {target.name}
      </Text>
      <Text style={styles.caption} numberOfLines={1}>{target.setupDone ? alreadySet : " "}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: APPLY_TILE_WIDTH, alignItems: "center" },
  glow: {
    position: "absolute",
    top: 0,
    left: 0,
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.55,
    shadowRadius: 26,
  },
  check: {
    position: "absolute",
    top: -2,
    right: -2,
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.bgBottom },
  checkOff: { backgroundColor: "rgba(0, 0, 0, 0.45)", borderWidth: 3, borderColor: white(0.55) },
  name: { ...text.heading, marginTop: 26, width: APPLY_TILE_WIDTH, textAlign: "center" },
  caption: { ...fonts.medium, fontSize: 24, lineHeight: 30, marginTop: 6, color: colors.textTertiary, textAlign: "center" },
});
