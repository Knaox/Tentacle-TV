import { memo, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem, ProblemActionKey, ProblemModel } from "@tentacle-tv/shared";
import { loadingArt } from "@/components/player/loading/loadingArt";
import { FONT_FAMILY, PLAYER, useResponsive } from "@/theme";
import { ProblemPanel } from "./ProblemPanel";
import { useProblemText } from "./useProblemText";

interface Props {
  model: ProblemModel;
  item?: MediaItem | null;
  onAction: (key: ProblemActionKey) => void;
  /** La croix de l'écran : la même sortie que « Retour à la fiche ». */
  onBack: () => void;
  busy?: ProblemActionKey | null;
}

/**
 * L'échec d'une lecture, en plein écran — l'écran d'ouverture de l'Apple TV
 * quand elle n'aboutit pas : le fond du titre assombri, son logo et
 * l'épisode, puis le message (quoi, pourquoi, quoi faire, détails) en bas à
 * gauche, et « Retour » en haut. Le lecteur reste sombre quel que soit le
 * thème. Le message est annoncé à VoiceOver et TalkBack à son arrivée.
 */
export const PlaybackProblemView = memo(function PlaybackProblemView({ model, item, onAction, onBack, busy = null }: Props) {
  const { t } = useTranslation("player");
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();
  const { isTablet, isLandscape } = useResponsive();
  const art = useMemo(() => loadingArt(client, item), [client, item]);
  const [logoReady, setLogoReady] = useState(false);
  const text = useProblemText(model);
  const background = !isLandscape && art.posterUrl ? art.posterUrl : (art.backdropUrl ?? art.posterUrl);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(text.announcement);
  }, [text.announcement]);

  const side = isTablet ? 48 : 24;
  return (
    <Animated.View entering={FadeIn.duration(220)} style={st.root}>
      {background ? (
        <Image source={{ uri: background }} contentFit="cover" transition={300} style={StyleSheet.absoluteFill} accessible={false} />
      ) : null}
      <LinearGradient
        colors={["rgba(0, 0, 0, 0.55)", "rgba(0, 0, 0, 0.82)", "#000"]}
        locations={[0, 0.45, 0.8]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={[st.content, {
          paddingTop: Math.max(insets.top, 12) + 72,
          paddingBottom: Math.max(insets.bottom, 16) + (isTablet ? 40 : 24),
          paddingLeft: Math.max(insets.left, side),
          paddingRight: Math.max(insets.right, side),
        }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={st.heading} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {art.logoUrl ? (
            <Image
              source={{ uri: art.logoUrl }}
              contentFit="contain"
              contentPosition="left"
              onLoad={() => setLogoReady(true)}
              style={[isTablet ? st.logoTablet : st.logo, !logoReady && st.pending]}
            />
          ) : null}
          {!logoReady && art.title !== "" ? <Text style={st.itemTitle} numberOfLines={2}>{art.title}</Text> : null}
          {art.subtitle ? <Text style={st.itemSubtitle} numberOfLines={1}>{art.subtitle}</Text> : null}
        </View>
        <ProblemPanel model={model} tone="player" onAction={onAction} busy={busy} />
      </ScrollView>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t("back")}
        hitSlop={8}
        style={({ pressed }) => [st.back, { top: Math.max(insets.top, 12) + 8, left: Math.max(insets.left, 16) }, pressed && st.pressed]}
      >
        <Feather name="chevron-left" size={20} color={PLAYER.text} />
        <Text style={st.backTxt}>{t("back")}</Text>
      </Pressable>
    </Animated.View>
  );
});

const st = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PLAYER.bg, zIndex: 40 },
  content: { flexGrow: 1, justifyContent: "flex-end", gap: 20 },
  heading: { gap: 6 },
  logo: { width: 200, height: 64 },
  logoTablet: { width: 300, height: 96 },
  pending: { position: "absolute", opacity: 0 },
  itemTitle: { color: PLAYER.text, fontSize: 24, lineHeight: 29, fontFamily: FONT_FAMILY.bold, letterSpacing: -0.4 },
  itemSubtitle: { color: "rgba(255, 255, 255, 0.55)", fontSize: 14, fontFamily: FONT_FAMILY.medium },
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
