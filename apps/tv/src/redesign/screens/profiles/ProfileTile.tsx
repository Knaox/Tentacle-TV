import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { pressScale, usePressProgress } from "../../motion/pressProgress";
import { Icon } from "../../icons/Icon";
import { colors, fonts, text, white } from "../../theme/tokens";
import { ProfileAvatar } from "./ProfileAvatar";
import type { ProfileTileModel } from "./profilesTypes";

/**
 * Un profil de « Qui regarde ? » : son rond (portrait ou initiale sur sa
 * couleur), son nom dessous, et ce qu'il faut savoir avant d'y entrer — le
 * cadenas d'un code PIN, « Invité », un blocage et son heure de fin. Au
 * focus : le rond grandit et s'élève, le nom s'allume — jamais d'anneau.
 */

export const TILE_AVATAR = 200;
/** La place d'une tuile : le rond agrandi, et un nom un peu plus large que lui. */
export const TILE_WIDTH = 248;
const FOCUS_SCALE = 1.12;

export const ProfileTile = memo(function ProfileTile({ model, focusKey, onPress, onFocusChange }: {
  model: ProfileTileModel;
  focusKey: string;
  onPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const { t } = useTranslation(["familyTv", "family"]);
  const details = [model.guest ? t("family:kindGuest") : null, model.hasPin ? t("familyTv:hasPin") : null, model.lockedLabel];
  const label = [model.name, ...details.filter(Boolean)].join(", ");
  return (
    <FocusTarget focusKey={focusKey} onPress={onPress} onFocusChange={onFocusChange} accessibilityLabel={label}>
      {(focused) => <Body model={model} focused={focused} guestLabel={t("family:kindGuest")} />}
    </FocusTarget>
  );
});

function Body({ model, focused, guestLabel }: { model: ProfileTileModel; focused: boolean; guestLabel: string }) {
  const p = useFocusProgress(focused);
  const press = usePressProgress();
  const lift = useAnimatedStyle(() => ({
    transform: [
      { translateY: -10 * p.value },
      { scale: (1 + (FOCUS_SCALE - 1) * p.value) * pressScale(press ? press.value : 0) },
    ],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: p.value }));
  const locked = model.lockedLabel !== null;
  return (
    <View style={styles.tile}>
      <Animated.View style={lift}>
        <Animated.View style={[styles.glow, glow]} />
        <View style={locked ? styles.dimmed : null}>
          <ProfileAvatar name={model.name} color={model.color} uri={model.avatarUri} size={TILE_AVATAR} />
        </View>
        {model.hasPin ? (
          <View style={styles.lock}>
            <Icon name="lock" size={26} color={colors.text} strokeWidth={2.4} />
          </View>
        ) : null}
      </Animated.View>
      <Text style={[styles.name, { color: focused ? colors.text : colors.textSecondary }]} numberOfLines={1}>
        {model.name}
      </Text>
      {locked ? (
        <Text style={[styles.caption, styles.locked]} numberOfLines={1}>{model.lockedLabel}</Text>
      ) : model.guest ? (
        <Text style={styles.caption} numberOfLines={1}>{guestLabel}</Text>
      ) : (
        <Text style={styles.caption}> </Text>
      )}
    </View>
  );
}

const LOCK = 52;

const styles = StyleSheet.create({
  tile: { width: TILE_WIDTH, alignItems: "center" },
  glow: {
    position: "absolute",
    top: 0,
    left: 0,
    width: TILE_AVATAR,
    height: TILE_AVATAR,
    borderRadius: TILE_AVATAR / 2,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 26 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
  },
  dimmed: { opacity: 0.45 },
  lock: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: LOCK,
    height: LOCK,
    borderRadius: LOCK / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: white(0.2),
  },
  name: { ...text.heading, marginTop: 30, maxWidth: TILE_WIDTH, textAlign: "center" },
  caption: { ...fonts.medium, fontSize: 24, lineHeight: 30, marginTop: 6, color: colors.textTertiary, textAlign: "center" },
  locked: { color: colors.warningFg },
});
