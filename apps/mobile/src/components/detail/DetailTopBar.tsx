import { StyleSheet, Text, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, spacing, typography, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { GradientOverlay, IconButton } from "@/components/ui";
import { HEADER_BAR_HEIGHT } from "@/components/PersistentHeader";

/** Course du fondu : la barre se solidifie sur les derniers points avant le seuil. */
const FADE_SPAN = 80;

interface Props {
  /** Montré quand le titre de la fiche sort de l'écran. */
  title: string;
  /** Défilement vertical de la fiche, en points. */
  scrollY: SharedValue<number>;
  /** Défilement à partir duquel la barre est pleine — la hauteur du héros, en pratique. */
  revealAt: number;
  onBack: () => void;
}

/**
 * La barre haute d'une fiche : elle protège la barre d'état, porte le retour,
 * et prend le titre quand celui de la page est parti.
 *
 * Le contenu passe DESSOUS — c'est ce qui garde l'affiche pleine hauteur. Deux
 * fonds s'y relaient donc : un voile sombre tant qu'on est sur l'image (sans
 * lui, l'heure et la batterie se posaient à même l'affiche), puis la surface
 * pleine du thème une fois le héros passé, avec son filet de séparation.
 * L'un s'efface quand l'autre paraît : jamais les deux à la fois.
 */
export function DetailTopBar({ title, scrollY, revealAt, onBack }: Props) {
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const topInset = Math.max(insets.top, 24);
  const height = topInset + HEADER_BAR_HEIGHT;
  const from = Math.max(0, revealAt - FADE_SPAN);

  const solidStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [from, revealAt], [0, 1], Extrapolation.CLAMP),
  }));
  const veilStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [from, revealAt], [1, 0], Extrapolation.CLAMP),
  }));
  // Le titre suit le verre, avec un léger retard : il ne doit pas se lire
  // par-dessus l'affiche.
  const titleStyle = useAnimatedStyle(() => {
    const progress = interpolate(scrollY.value, [revealAt - FADE_SPAN / 2, revealAt], [0, 1], Extrapolation.CLAMP);
    return { opacity: progress, transform: [{ translateY: (1 - progress) * 6 }] };
  });

  return (
    <View pointerEvents="box-none" style={[st.wrap, { height }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, veilStyle]}>
        {/* Noir explicite : le fond du thème CLAIR délaverait la barre d'état
            au lieu de la détacher (cf. `HeroBanner`). */}
        <GradientOverlay direction="top" height={height} intensity="soft" color="rgba(0, 0, 0, 0.75)" />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.solid, solidStyle]}>
        <View style={st.hairline} />
      </Animated.View>
      <View style={[st.row, { paddingTop: topInset }]}>
        <IconButton icon="←" size={36} onPress={onBack} accessibilityLabel={t("back")} bgColor={theme.colors.glass.backdrop} />
        <Animated.View style={[st.titleWrap, titleStyle]} pointerEvents="none">
          <Text style={st.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 },
    // Surface PLEINE, pas du verre : une barre qui se pose sur du texte doit
    // le cacher. Le verre d'iOS 26 ne floute rien dans un calque en fondu —
    // le texte de la page restait lisible au travers.
    solid: { backgroundColor: t.colors.surface.s0 },
    row: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.screenPadding,
    },
    titleWrap: { flex: 1 },
    title: {
      ...typography.subtitle,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.primary,
    },
    hairline: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: withAlpha(t.colors.brand.violet, 0.12, t.colors.border.strong),
    },
  });
