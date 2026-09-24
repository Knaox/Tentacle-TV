import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, PLAYER, useResponsive, withAlpha } from "@/theme";
import { LoadingBar } from "./LoadingBar";
import { loadingArt } from "./loadingArt";

interface Props {
  item?: MediaItem | null;
  /**
   * Quitter sans attendre le démarrage — toujours offert pendant l'ouverture :
   * un serveur lent ou un transcodage qui démarre ne doit enfermer personne.
   */
  onCancel?: () => void;
}

/**
 * L'écran de chargement du lecteur, plein écran — celui du bureau : le fond du
 * titre qui apparaît en fondu sous un voile, le logo (ou le titre) et
 * l'épisode en bas, la barre de chargement dessous, et « Retour » en haut à
 * gauche. Il couvre TOUTE l'ouverture, de la route à la première image : la
 * source locale vérifiée, la négociation, puis le moteur qui charge. Il
 * s'efface en fondu quand l'image arrive.
 *
 * Couleurs du lecteur (PLAYER) : l'écran reste sombre quel que soit le thème,
 * comme le lecteur qu'il annonce.
 */
export function PlayerLoadingScreen({ item, onCancel }: Props) {
  const { t } = useTranslation("player");
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();
  const { isTablet, isLandscape } = useResponsive();
  const art = useMemo(() => loadingArt(client, item), [client, item]);
  const [logoReady, setLogoReady] = useState(false);
  const label = art.title ? t("loadingMedia", { title: art.title }) : t("loading");
  // Portrait : l'affiche épouse l'écran ; paysage : le fond, comme le bureau.
  const usePoster = !isLandscape && art.posterUrl !== null;
  const background = usePoster ? art.posterUrl : (art.backdropUrl ?? art.posterUrl);

  return (
    <Animated.View exiting={FadeOut.duration(280)} style={st.root}>
      {background && (
        <Image
          source={{ uri: background }}
          contentFit="cover"
          // L'affiche déborde vers le bas, calée en haut : sa bande de titre
          // imprimée sort de l'écran au lieu de doubler notre logo.
          contentPosition={usePoster ? "top" : "center"}
          transition={500}
          style={usePoster ? st.poster : StyleSheet.absoluteFill}
          accessible={false}
        />
      )}
      {/* Une lueur de marque en haut à gauche, puis le voile qui assombrit
          vers le bas : le texte se lit sur n'importe quelle image. */}
      <LinearGradient
        colors={[withAlpha(PLAYER.accent, 0.2, "rgba(139, 92, 246, 0.2)"), "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.75, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(0, 0, 0, 0.3)", "rgba(0, 0, 0, 0.72)", "#000"]}
        locations={[0, 0.5, 0.86]}
        style={StyleSheet.absoluteFill}
      />

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        style={[st.bottom, {
          paddingBottom: Math.max(insets.bottom, 16) + (isTablet ? 48 : 32),
          paddingLeft: Math.max(insets.left, isTablet ? 48 : 24),
          paddingRight: Math.max(insets.right, isTablet ? 48 : 24),
        }]}
      >
        {art.logoUrl && (
          <Image
            source={{ uri: art.logoUrl }}
            contentFit="contain"
            contentPosition="left"
            onLoad={() => setLogoReady(true)}
            style={[isTablet ? st.logoTablet : st.logo, !logoReady && st.pending]}
          />
        )}
        {!logoReady && art.title !== "" && (
          <Text style={[st.title, isTablet && st.titleTablet]} numberOfLines={2}>{art.title}</Text>
        )}
        {art.subtitle && <Text style={st.subtitle} numberOfLines={1}>{art.subtitle}</Text>}
        <View style={st.bar}>
          <LoadingBar />
        </View>
      </View>

      {onCancel && (
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          hitSlop={8}
          style={({ pressed }) => [st.back, { top: Math.max(insets.top, 12) + 8, left: Math.max(insets.left, 16) }, pressed && st.pressed]}
        >
          <Feather name="chevron-left" size={20} color={PLAYER.text} />
          <Text style={st.backTxt}>{t("back")}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0a0a12", zIndex: 30, overflow: "hidden" },
  poster: { position: "absolute", top: 0, left: 0, right: 0, height: "116%" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, gap: 6 },
  logo: { width: 220, height: 72, marginBottom: 4 },
  logoTablet: { width: 340, height: 110, marginBottom: 6 },
  pending: { position: "absolute", opacity: 0 },
  title: { color: PLAYER.text, fontSize: 26, lineHeight: 31, fontFamily: FONT_FAMILY.bold, letterSpacing: -0.4 },
  titleTablet: { fontSize: 36, lineHeight: 42 },
  subtitle: { color: "rgba(255, 255, 255, 0.55)", fontSize: 15, fontFamily: FONT_FAMILY.medium },
  bar: { marginTop: 14, maxWidth: 520 },
  back: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
    paddingLeft: 12,
    paddingRight: 18,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  pressed: { backgroundColor: "rgba(0, 0, 0, 0.7)" },
  backTxt: { color: "rgba(255, 255, 255, 0.9)", fontSize: 14, fontFamily: FONT_FAMILY.semibold },
});
