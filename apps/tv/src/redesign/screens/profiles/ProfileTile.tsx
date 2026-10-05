import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_MOTION } from "@tentacle-tv/theme";
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
 *
 * L'ENTRÉE dans un profil (`entrance`) : le choisi glisse au centre de la
 * rangée et grandit, les autres reculent et s'effacent — `transform` et
 * `opacity` seuls, sur le fil d'interface. Animations réduites : rien ne
 * bouge, les autres s'effacent seulement.
 */

export const TILE_AVATAR = 200;
/** La place d'une tuile : le rond agrandi, et un nom un peu plus large que lui. */
export const TILE_WIDTH = 248;
/** L'écart entre deux tuiles de la rangée. */
export const TILE_GAP = 40;
const FOCUS_SCALE = 1.12;

/**
 * L'entrée dans un profil, partagée par la rangée : sa progression (0 → 1, et
 * retour à 0 si le serveur refuse), et l'index du choisi — posé au choix, il
 * n'est jamais remis à zéro : le retour se joue avec les mêmes rôles.
 */
export interface TileEntrance {
  progress: SharedValue<number>;
  chosen: SharedValue<number>;
  count: number;
  /** Animations réduites : aucun déplacement, aucun agrandissement. */
  still: boolean;
}

export const ProfileTile = memo(function ProfileTile({ model, index, focusKey, entrance, front, disabled, onPress, onFocusChange }: {
  model: ProfileTileModel;
  index: number;
  focusKey: string;
  entrance: TileEntrance;
  /** Le choisi (de la dernière entrée) passe devant ses voisines, qu'il survole en gagnant le centre. */
  front?: boolean;
  /** Pendant l'entrée, seul le choisi reste une cible : le focus ne fuit pas vers une tuile effacée. */
  disabled?: boolean;
  onPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const { t } = useTranslation(["familyTv", "family"]);
  const details = [model.guest ? t("family:kindGuest") : null, model.hasPin ? t("familyTv:hasPin") : null, model.lockedLabel];
  const label = [model.name, ...details.filter(Boolean)].join(", ");
  return (
    <Entering entrance={entrance} index={index} front={front}>
      <FocusTarget focusKey={focusKey} onPress={onPress} onFocusChange={onFocusChange} accessibilityLabel={label} disabled={disabled}>
        {(focused) => <Body model={model} focused={focused} guestLabel={t("family:kindGuest")} />}
      </FocusTarget>
    </Entering>
  );
});

const { advanceScale, recedeScale } = TV_MOTION.profile;

/** Toujours monté (une tuile qui changerait d'enveloppe se remonterait, et perdrait le focus).
 *  Jamais aplati non plus (`collapsable={false}`) : sur Android, `zIndex` posé
 *  au focus ferait créer la vue et re-parenter la tuile — qui perdrait le focus. */
function Entering({ entrance, index, front, children }: { entrance: TileEntrance; index: number; front?: boolean; children: ReactNode }) {
  const { progress, chosen, count, still } = entrance;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    if (chosen.value === index) {
      // Le centre de la rangée : elle est centrée, ses tuiles ont toutes la même place.
      const shiftX = ((count - 1) / 2 - index) * (TILE_WIDTH + TILE_GAP);
      return { opacity: 1, transform: still ? [] : [{ translateX: shiftX * p }, { scale: 1 + (advanceScale - 1) * p }] };
    }
    return { opacity: 1 - p, transform: still ? [] : [{ scale: 1 - (1 - recedeScale) * p }] };
  });
  return (
    <Animated.View collapsable={false} style={[front ? styles.front : null, style]}>
      {children}
    </Animated.View>
  );
}

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
  front: { zIndex: 1 },
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
