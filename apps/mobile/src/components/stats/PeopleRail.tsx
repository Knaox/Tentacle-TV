import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { ViewingStatsPerson } from "@tentacle-tv/shared";
import { FONT_FAMILY, spacing, useThemedStyles, type AppTheme } from "@/theme";
import { useStatsFormat } from "./useStatsFormat";

const TMDB_PROFILE = "https://image.tmdb.org/t/p/w185";
const SIZE = 72;

/**
 * Les visages les plus retrouvés : portrait rond (initiale sans portrait),
 * nom, temps passé et nombre de titres. Toucher un visage lance la recherche
 * de son nom — ses autres titres de la bibliothèque.
 */
export const PeopleRail = memo(function PeopleRail({ people, inset }: { people: ViewingStatsPerson[]; inset: number }) {
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const router = useRouter();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -inset }}
      contentContainerStyle={{ paddingHorizontal: inset, gap: spacing.lg }}
    >
      {people.map((p) => {
        const caption = `${f.duration(p.seconds)} · ${f.t("personTitles", { count: p.titles })}`;
        return (
          <Pressable
            key={`${p.role}-${p.tmdbId}`}
            onPress={() => router.push({ pathname: "/search", params: { q: p.name } })}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}, ${caption}`}
            style={({ pressed }) => [st.person, pressed && st.pressed]}
          >
            <View style={st.portrait}>
              {p.profilePath ? (
                <Image source={{ uri: `${TMDB_PROFILE}${p.profilePath}` }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              ) : (
                <Text style={st.initial}>{p.name.charAt(0)}</Text>
              )}
            </View>
            <Text style={st.name} numberOfLines={2}>{p.name}</Text>
            <Text style={st.caption} numberOfLines={1}>{caption}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    person: { width: 88, alignItems: "center" },
    pressed: { opacity: 0.7 },
    portrait: {
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.soft,
    },
    initial: { fontSize: 24, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.quaternary },
    name: { marginTop: 8, fontSize: 12, lineHeight: 16, textAlign: "center", fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    caption: { marginTop: 2, fontSize: 11, textAlign: "center", fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  });
