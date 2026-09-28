/**
 * La carte d'un titre HORS bibliothèque : celle des sections « Pas encore sur
 * le serveur » de la recherche, d'une filmographie ou d'une saga. La largeur
 * vient du parent (rail ou grille).
 *
 * Au doigt, pas de survol : l'appui long ouvre la feuille des cartes Vigie
 * (`ExternalActionSheet` — « Demander », Ma liste à l'arrivée, la note),
 * portée par la carte elle-même, pour que toute rangée qui la montre l'ait.
 * Il faut l'identifiant TMDB du titre (`item.tmdbId`). La pastille suit
 * l'état que l'extension donne du titre (« Demandé » dès la demande).
 */

import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { titleMediaType, type ExternalSearchItem, type ExternalTone } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { ExternalActionSheet, type ExternalSheetTarget } from "@/components/external/ExternalActionSheet";
import { useExternalTitleState, type ExternalTitle } from "@/components/external/useExternalTitle";

/** Une affiche hors bibliothèque : contour pointillé, pastille d'état du plugin, titre et année. */
export function ExternalResultCard({ item, width, onPress, onOpenHref }: {
  item: ExternalSearchItem;
  width: number;
  onPress: () => void;
  /** La page de l'extension ouverte depuis la feuille (« Choisir les saisons ») — sinon, empilée. */
  onOpenHref?: (href: string) => void;
}) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const [sheet, setSheet] = useState<ExternalSheetTarget | null>(null);
  const title = useMemo<ExternalTitle | null>(
    () => (item.tmdbId ? { mediaType: titleMediaType(item.kind), tmdbId: item.tmdbId } : null),
    [item.kind, item.tmdbId],
  );
  const state = useExternalTitleState(title);
  const badge = state?.badge ?? item.badge;

  return (
    <>
      <Pressable
        onPress={onPress}
        onLongPress={title ? () => setSheet({ title, name: item.title, year: item.year, imageUrl: item.imageUrl }) : undefined}
        accessibilityRole="button"
        accessibilityLabel={[item.title, item.year, badge?.label].filter(Boolean).join(", ")}
        style={({ pressed }) => [{ width }, pressed && st.pressed]}
      >
        <View style={[st.poster, { width, height: width * 1.5 }]}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessible={false} />
          ) : (
            <Feather name={item.kind === "series" ? "tv" : "film"} size={26} color={theme.colors.text.quaternary} />
          )}
          {badge && <Badge label={badge.label} tone={badge.tone} />}
        </View>
        <Text style={st.itemTitle} numberOfLines={2}>{item.title}</Text>
        {item.year !== null && <Text style={st.itemYear}>{item.year}</Text>}
      </Pressable>
      {title && <ExternalActionSheet target={sheet} variant="poster" onClose={() => setSheet(null)} openHref={onOpenHref} />}
    </>
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
