import { memo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { initials, personMeta, type SearchFacetHit, type SearchPersonHit } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useThemedStyles, type AppTheme } from "@/theme";

/** Un portrait — la photo Jellyfin quand elle existe, sinon les initiales. */
export function PersonAvatar({ person, size }: { person: Pick<SearchPersonHit, "id" | "name" | "imageTag">; size: number }) {
  const client = useJellyfinClient();
  const st = useThemedStyles(makeStyles);
  const uri = person.imageTag ? client.getImageUrl(person.id, "Primary", { height: size * 3, quality: 85 }) : null;
  return (
    <View style={[st.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessible={false} />
      ) : (
        <Text style={[st.initials, { fontSize: size * 0.34 }]}>{initials(person.name)}</Text>
      )}
    </View>
  );
}

/** Les personnes qui répondent, en rail : portrait, nom, ce qu'elles représentent ici. */
export const PeopleRail = memo(function PeopleRail({ people, onOpen }: {
  people: SearchPersonHit[];
  onOpen: (person: SearchPersonHit) => void;
}) {
  const { t } = useTranslation("search");
  const st = useThemedStyles(makeStyles);
  return (
    <FlatList
      horizontal
      data={people}
      keyExtractor={(p) => p.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.rail}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item: person }) => (
        <Pressable
          onPress={() => onOpen(person)}
          accessibilityRole="button"
          accessibilityLabel={`${person.name}, ${personMeta(t, person)}`}
          style={({ pressed }) => [st.person, pressed && st.pressed]}
        >
          <PersonAvatar person={person} size={72} />
          <Text style={st.name} numberOfLines={2}>{person.name}</Text>
          <Text style={st.meta} numberOfLines={1}>{t("titles", { count: person.count })}</Text>
        </Pressable>
      )}
    />
  );
});

/** Genres et studios : une pastille chacun, le nombre de titres au bout. */
export const FacetChips = memo(function FacetChips({ genres, studios, onOpen }: {
  genres: SearchFacetHit[];
  studios: SearchFacetHit[];
  onOpen: (kind: "genre" | "studio", name: string) => void;
}) {
  const { t } = useTranslation("search");
  const st = useThemedStyles(makeStyles);
  const chips = [
    ...genres.map((g) => ({ kind: "genre" as const, ...g })),
    ...studios.map((s) => ({ kind: "studio" as const, ...s })),
  ];
  return (
    <View style={st.chips}>
      {chips.map((chip) => (
        <Pressable
          key={`${chip.kind}:${chip.name}`}
          onPress={() => onOpen(chip.kind, chip.name)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`${t(chip.kind)} ${chip.name}, ${t("titles", { count: chip.count })}`}
          style={({ pressed }) => [st.chip, pressed && st.pressed]}
        >
          <Text style={st.chipKind}>{t(chip.kind)}</Text>
          <Text style={st.chipTxt} numberOfLines={1}>{chip.name}</Text>
          <Text style={st.chipCount}>{chip.count}</Text>
        </Pressable>
      ))}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    avatar: {
      overflow: "hidden" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: t.colors.brand.soft,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
    },
    initials: { fontFamily: FONT_FAMILY.bold, color: t.colors.brand.light },
    rail: { paddingHorizontal: spacing.screenPadding, gap: 14 },
    person: { width: 84, alignItems: "center" as const, gap: 6 },
    pressed: { opacity: 0.7 },
    name: { fontSize: 13, lineHeight: 16, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, textAlign: "center" as const },
    meta: { fontSize: 11, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary, marginTop: -2 },
    chips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, paddingHorizontal: spacing.screenPadding },
    chip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      height: 36,
      paddingHorizontal: 12,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.subtle,
    },
    chipKind: { fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.tertiary },
    chipTxt: { fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, maxWidth: 180 },
    chipCount: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
  });
