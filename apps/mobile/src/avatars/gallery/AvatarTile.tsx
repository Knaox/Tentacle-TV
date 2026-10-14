import { memo, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { AvatarCharacter } from "@tentacle-tv/shared";
import { typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { AVATAR_THUMBS } from "../avatarAssets.generated";
import { restOf, TEMPERAMENT_MOTION } from "./temperamentMotion";
import type { GalleryLayout } from "./galleryLayout";

/** L'anneau du personnage désigné, autour du rond. */
const RING = 3;
const RING_GAP = 2;

interface AvatarTileProps {
  avatar: AvatarCharacter;
  name: string;
  designated: boolean;
  disabled: boolean;
  layout: GalleryLayout;
  onPress: (id: string) => void;
}

/**
 * Un personnage de la troupe : son portrait rond (sur la couleur de son fond
 * le temps que l'image arrive), son nom dessous. Toucher le DÉSIGNE — anneau
 * et coche de la marque, son histoire au pied de la galerie, et il bouge une
 * fois selon son tempérament (rien en mouvement réduit) ; le toucher encore le
 * prend (`onPress` en décide). La tuile entière est la cible.
 */
export const AvatarTile = memo(function AvatarTile({ avatar, name, designated, disabled, layout, onPress }: AvatarTileProps) {
  const { t } = useTranslation("avatars");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const reduceMotion = useReducedMotion();
  const motion = TEMPERAMENT_MOTION[avatar.temperament];
  const offset = useSharedValue(restOf(motion.property));

  useEffect(() => {
    if (!designated || reduceMotion) return;
    offset.value = withSequence(...motion.values.map((value) => withTiming(value, { duration: motion.stepMs })));
  }, [designated, reduceMotion, motion, offset]);

  const moving = useAnimatedStyle(() => {
    switch (motion.property) {
      case "translateX":
        return { transform: [{ translateX: offset.value }] };
      case "translateY":
        return { transform: [{ translateY: offset.value }] };
      case "rotateDeg":
        return { transform: [{ rotate: `${offset.value}deg` }] };
      case "scale":
        return { transform: [{ scale: offset.value }] };
    }
  });

  const ring = layout.art + (RING + RING_GAP) * 2;
  return (
    <Pressable
      onPress={() => onPress(avatar.id)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityHint={designated ? t("mobile.chosenHint") : t("mobile.tileHint")}
      accessibilityState={{ selected: designated, disabled }}
      style={({ pressed }) => [st.tile, { width: layout.tileWidth }, pressed && st.pressed]}
    >
      <Animated.View style={[{ width: ring, height: ring }, moving]}>
        <View
          style={[
            st.ring,
            { width: ring, height: ring, borderRadius: ring / 2 },
            designated && { borderColor: theme.colors.brand.violet },
          ]}
        >
          <View style={[st.art, { width: layout.art, height: layout.art, borderRadius: layout.art / 2, backgroundColor: avatar.tone }]}>
            <Image
              source={AVATAR_THUMBS[avatar.id]}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={reduceMotion ? 0 : 120}
              recyclingKey={avatar.id}
              accessible={false}
            />
          </View>
        </View>
        {designated ? (
          <View style={st.check}>
            <Feather name="check" size={12} color={theme.colors.cta.brandFg} />
          </View>
        ) : null}
      </Animated.View>
      <Text style={[st.name, designated && st.nameDesignated]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    tile: { alignItems: "center", paddingTop: 4, paddingBottom: 6, gap: 6, borderRadius: 16 },
    pressed: { opacity: 0.7 },
    ring: { borderWidth: RING, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
    art: { overflow: "hidden" },
    check: {
      position: "absolute",
      right: 0,
      bottom: 0,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: t.colors.brand.violet,
      borderWidth: 2,
      borderColor: t.colors.glass.panel,
      alignItems: "center",
      justifyContent: "center",
    },
    name: { ...typography.caption, color: t.colors.text.secondary, maxWidth: "100%" },
    nameDesignated: { color: t.colors.text.primary, fontFamily: typography.bodyBold.fontFamily, fontWeight: "600" },
  });
