import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Bookmark, ChevronRight } from "lucide-react-native";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { ViewingStatsTaste } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { useStatsFormat } from "./useStatsFormat";

const TMDB_POSTER = "https://image.tmdb.org/t/p/w154";

/**
 * « À voir » — les titres seulement dans Ma liste, ni vus ni aimés : un
 * POTENTIEL, pas un avis (cf. le web). Une tuile discrète : le compte,
 * quelques affiches, le chemin vers Ma liste — aucun pourcentage, ces titres
 * ne pèsent sur aucune statistique de l'écran.
 */
export const PotentialTile = memo(function PotentialTile({ taste }: { taste: ViewingStatsTaste }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const client = useJellyfinClient();
  const router = useRouter();
  const potential = taste.potential;
  if (!potential || potential.count === 0) return null;
  const posters = potential.titles
    .map((p) => ({
      key: p.key,
      url: p.jellyfinId
        ? client.getImageUrl(p.jellyfinId, "Primary", { width: 120, quality: 80 })
        : p.posterPath ? `${TMDB_POSTER}${p.posterPath}` : null,
    }))
    .filter((p): p is { key: string; url: string } => p.url !== null);
  const body = f.t("potentialBody", { count: potential.count });

  return (
    <View style={st.tile}>
      <View style={st.head} accessible accessibilityLabel={`${f.t("potentialTitle")}. ${body} ${f.t("potentialNote")}`}>
        <View style={st.icon}>
          <Bookmark size={17} color={theme.colors.text.secondary} strokeWidth={2} />
        </View>
        <View style={st.texts}>
          <Text style={st.title} accessibilityRole="header">{f.t("potentialTitle")}</Text>
          <Text style={st.body}>{body}</Text>
          <Text style={st.note}>{f.t("potentialNote")}</Text>
        </View>
      </View>
      <View style={st.foot}>
        {posters.length > 0 ? (
          <View style={st.posters} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {posters.map((p, i) => (
              <View key={p.key} style={[st.poster, i > 0 && st.overlap]}>
                <Image source={{ uri: p.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              </View>
            ))}
          </View>
        ) : <View />}
        <Pressable
          onPress={() => router.push("/watchlist")}
          accessibilityRole="button"
          accessibilityLabel={f.t("potentialCta")}
          style={({ pressed }) => [st.cta, pressed && st.pressed]}
          hitSlop={6}
        >
          <Text style={st.ctaTxt}>{f.t("potentialCta")}</Text>
          <ChevronRight size={16} color={theme.colors.text.secondary} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    tile: {
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.faint,
    },
    head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    icon: { width: 36, height: 36, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.fill.soft },
    texts: { flex: 1, minWidth: 0 },
    title: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    body: { marginTop: 2, fontSize: 13, lineHeight: 18, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    note: { marginTop: 2, fontSize: 12, lineHeight: 16, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 48 },
    posters: { flexDirection: "row" },
    poster: {
      width: 36,
      height: 54,
      borderRadius: RADIUS.sm,
      overflow: "hidden",
      borderWidth: 2,
      borderColor: t.colors.surface.s0,
      backgroundColor: t.colors.fill.soft,
    },
    overlap: { marginLeft: -10 },
    cta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      height: 36,
      paddingLeft: 14,
      paddingRight: 10,
      borderRadius: RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.strong,
      backgroundColor: t.colors.surface.s2,
    },
    pressed: { opacity: 0.7 },
    ctaTxt: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
  });
