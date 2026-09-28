/**
 * La carte d'un titre HORS bibliothèque : celle des sections « Pas encore sur
 * le serveur » de la recherche et d'une filmographie. La largeur vient du
 * parent (rail ou grille).
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import type { ExternalSearchItem, ExternalTone } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/** Une affiche hors bibliothèque : contour pointillé, pastille d'état du plugin, titre et année. */
export function ExternalResultCard({ item, width, onPress }: { item: ExternalSearchItem; width: number; onPress: () => void }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[item.title, item.year, item.badge?.label].filter(Boolean).join(", ")}
      style={({ pressed }) => [{ width }, pressed && st.pressed]}
    >
      <View style={[st.poster, { width, height: width * 1.5 }]}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessible={false} />
        ) : (
          <Feather name={item.kind === "series" ? "tv" : "film"} size={26} color={theme.colors.text.quaternary} />
        )}
        {item.badge && <Badge label={item.badge.label} tone={item.badge.tone} />}
      </View>
      <Text style={st.itemTitle} numberOfLines={2}>{item.title}</Text>
      {item.year !== null && <Text style={st.itemYear}>{item.year}</Text>}
    </Pressable>
  );
}

/** La pastille d'état que le plugin pose sur un titre (« Demandé », « Bientôt »…). */
function Badge({ label, tone }: { label: string; tone: ExternalTone }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const pair = tone === "neutral" ? null : theme.colors.statusPairs[tone === "info" ? "info" : tone];
  return (
    <View style={[st.badge, pair && { backgroundColor: pair.bg }]}>
      <Text style={[st.badgeTxt, pair && { color: pair.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    pressed: { opacity: 0.7 },
    poster: {
      borderRadius: RADIUS.md,
      overflow: "hidden" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: t.colors.surface.s2,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      borderStyle: "dashed" as const,
    },
    badge: {
      position: "absolute" as const,
      left: 6,
      bottom: 6,
      maxWidth: "88%" as const,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: RADIUS.pill,
      backgroundColor: "rgba(0, 0, 0, 0.72)",
    },
    badgeTxt: { fontSize: 10.5, fontFamily: FONT_FAMILY.semibold, color: "#FFFFFF" },
    itemTitle: { marginTop: 6, fontSize: 13, lineHeight: 16, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    itemYear: { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  });
