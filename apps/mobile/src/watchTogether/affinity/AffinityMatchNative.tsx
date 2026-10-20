import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { useReducedMotion } from "react-native-reanimated";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { WtAffinityMatchDto, WtRoomStateDto } from "@tentacle-tv/shared";
import { Button } from "@/components/ui/Button";
import { FONT_FAMILY, RADIUS, useThemedStyles, type AppTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { formatNames, memberName } from "./affinityText";

type Answer = "watch" | "continue";

/**
 * « C'est un match ! » — la proposition faite à TOUS les participants à la
 * fois, et deux réponses : « Regarder ensemble » (la lecture part pour le
 * groupe) ou « Continuer à swiper » (le match est écarté chez tous). La
 * première réponse vaut pour tous, et le dit. L'affiche entre une fois
 * (ressort) ; avec le mouvement réduit, un fondu.
 */
export function AffinityMatchNative({ match, room, selfId, participantCount, onWatch, onKeepSwiping }: {
  match: WtAffinityMatchDto;
  room: WtRoomStateDto | null;
  selfId: string | null;
  participantCount: number;
  /** Rejette si le serveur refuse (un autre a répondu : l'état suivant dit la suite). */
  onWatch: () => Promise<void>;
  onKeepSwiping: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation("watchTogether");
  const s = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const reduced = useReducedMotion();
  const [answering, setAnswering] = useState<Answer | null>(null);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    haptic("success");
    const anim = reduced
      ? Animated.timing(enter, { toValue: 1, duration: 200, useNativeDriver: true })
      : Animated.spring(enter, { toValue: 1, damping: 12, stiffness: 160, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [enter, reduced]);

  const nameOf = (id: string) => (id === selfId ? t("affinityYou") : memberName(room, id) || "…");
  const others = match.likedBy.filter((id) => id !== selfId).map(nameOf);
  const subtitle = selfId && match.likedBy.includes(selfId)
    ? t("affinityMatchWithYou", { names: formatNames(others, i18n.language), title: match.title })
    : t("affinityMatchOthers", { names: formatNames(match.likedBy.map(nameOf), i18n.language), title: match.title });
  const meta = [match.year, match.mediaType === "tv" ? t("affinitySeries") : t("affinityMovie")].filter(Boolean).join(" · ");
  const poster = client.getImageUrl(match.itemId, "Primary", { width: 500, quality: 85 });

  const answer = (kind: Answer, run: () => Promise<void>) => (): void => {
    setAnswering(kind);
    run().catch(() => setAnswering(null));
  };

  const scale = reduced ? 1 : enter.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <View style={s.wrap} accessibilityViewIsModal testID="wt-affinity-match">
      <Animated.View style={{ opacity: enter, transform: [{ scale }] }}>
        <Image source={{ uri: poster }} style={s.poster} contentFit="cover" accessibilityLabel={match.title} />
      </Animated.View>
      <Text style={s.title} accessibilityRole="header">{t("affinityMatchTitle")}</Text>
      <Text style={s.subtitle}>{subtitle}</Text>
      {meta !== "" && <Text style={s.meta}>{meta}</Text>}
      <View style={s.actions}>
        <Button title={t("affinityWatchTogether")} onPress={answer("watch", onWatch)} loading={answering === "watch"}
          disabled={answering !== null} fullWidth />
        <Button title={t("affinityKeepSwiping")} onPress={answer("continue", onKeepSwiping)} variant="secondary"
          loading={answering === "continue"} disabled={answering !== null} fullWidth />
      </View>
      <Text style={s.small}>{t("affinityFirstAnswer", { count: Math.max(1, participantCount - 1) })}</Text>
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  poster: { width: 180, height: 270, borderRadius: RADIUS.xl, backgroundColor: t.colors.fill.subtle },
  title: { marginTop: 12, color: t.colors.text.primary, fontSize: 26, fontFamily: FONT_FAMILY.extrabold, textAlign: "center" },
  subtitle: { color: t.colors.text.secondary, fontSize: 15, lineHeight: 21, textAlign: "center", fontFamily: FONT_FAMILY.regular },
  meta: { color: t.colors.text.tertiary, fontSize: 13, fontFamily: FONT_FAMILY.regular },
  actions: { alignSelf: "stretch", maxWidth: 420, width: "100%", marginTop: 12, gap: 10 },
  small: { color: t.colors.text.tertiary, fontSize: 12, textAlign: "center", fontFamily: FONT_FAMILY.regular },
});
