import { memo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { CardFrame } from "../../cards/CardFrame";
import { FocusGroup } from "../../focus/FocusGroup";
import { FocusTarget } from "../../focus/FocusTarget";
import { useForcedFocusKey } from "../../focus/focusPreview";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { colors, fonts, white } from "../../theme/tokens";
import { DETAIL_LEFT } from "./DetailSection";
import type { CrewGroupModel, PersonModel } from "./detailTypes";

/**
 * Casting et équipe : les portraits RONDS de la distribution (nom, rôle),
 * focalisables — OK ouvre la filmographie —, puis l'équipe en colonnes
 * (réalisation, scénario, production, musique, studio), du texte seul.
 * Sans portrait, le disque garde la lumière de la personne (son BlurHash) et
 * ses initiales : jamais une silhouette grise, jamais une fausse photo.
 *
 * Contrat : `useMediaItem` (`People`, `Studios` — déjà dans l'item), l'image
 * `Primary` de chaque personne et son BlurHash (`paletteFromBlurHash`).
 * Groupe de focus : `detail:cast` ; éléments `cast:<i>`.
 */

const SIZE = TV_STAGE.card.person.size;
const CELL = SIZE + 36;
const NAME_SHIFT = SIZE * (TV_STAGE.focus.cardScale - 1);

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

function Portrait({ person }: { person: PersonModel }) {
  if (person.imageUri) {
    return <Image source={{ uri: person.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />;
  }
  const [a, b] = person.palette?.glows ?? [colors.surface3, colors.surface2];
  return (
    <LinearGradient colors={[a, b]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[StyleSheet.absoluteFill, styles.center]}>
      <Text style={styles.initials}>{initials(person.name)}</Text>
    </LinearGradient>
  );
}

function Names({ person, focused }: { person: PersonModel; focused: boolean }) {
  const p = useFocusProgress(focused);
  const shift = useAnimatedStyle(() => ({ transform: [{ translateY: NAME_SHIFT * p.value }] }));
  return (
    <Animated.View style={[styles.names, shift]}>
      <Text style={[styles.name, focused && styles.nameFocused]} numberOfLines={2}>{person.name}</Text>
      {person.role ? <Text style={styles.role} numberOfLines={2}>{person.role}</Text> : null}
    </Animated.View>
  );
}

export const CastRow = memo(function CastRow({
  people,
  onOpen,
  onFocusChange,
}: {
  people: PersonModel[];
  onOpen?: (person: PersonModel) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const [nativeIndex, setNativeIndex] = useState<number | null>(null);
  const forced = useForcedFocusKey();
  const forcedIndex = forced?.startsWith("cast:") ? Number(forced.slice(5)) : null;
  const focusedIndex = forced !== null ? forcedIndex : nativeIndex;
  return (
    <FocusGroup focusKey="detail:cast">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.track} contentContainerStyle={styles.content}>
        {people.map((person, index) => (
          <FocusTarget
            key={`${person.id}-${index}`}
            focusKey={`cast:${index}`}
            onPress={onOpen ? () => onOpen(person) : undefined}
            onFocusChange={(focused) => {
              setNativeIndex((current) => (focused ? index : current === index ? null : current));
              onFocusChange?.(focused);
            }}
            accessibilityLabel={person.role ? `${person.name}, ${person.role}` : person.name}
            style={styles.cell}
          >
            {(focused) => (
              <View style={styles.center}>
                <CardFrame width={SIZE} height={SIZE} radius={SIZE / 2} focused={focused} dimmed={focusedIndex !== null && focusedIndex !== index}>
                  <Portrait person={person} />
                </CardFrame>
                <Names person={person} focused={focused} />
              </View>
            )}
          </FocusTarget>
        ))}
      </ScrollView>
    </FocusGroup>
  );
});

/** L'équipe, en colonnes : le métier, puis les noms (trois au plus). */
export const CrewColumns = memo(function CrewColumns({ groups }: { groups: CrewGroupModel[] }) {
  return (
    <View style={styles.crew}>
      {groups.map((group) => (
        <View key={group.key} style={styles.crewColumn}>
          <Text style={styles.crewLabel} numberOfLines={1}>{group.label}</Text>
          {group.names.slice(0, 3).map((name) => (
            <Text key={name} style={styles.crewName} numberOfLines={1}>{name}</Text>
          ))}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  track: { overflow: "visible" },
  content: { gap: 28, paddingLeft: DETAIL_LEFT - 18, paddingRight: TV_STAGE.safe.x, paddingTop: 14, paddingBottom: 16 },
  cell: { width: CELL },
  center: { alignItems: "center", justifyContent: "center" },
  initials: { ...fonts.extrabold, fontSize: 52, letterSpacing: 1, color: white(0.92) },
  names: { marginTop: 18, alignItems: "center", gap: 4 },
  name: { ...fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.textSecondary, textAlign: "center" },
  nameFocused: { color: colors.text },
  role: { ...fonts.medium, fontSize: 22, lineHeight: 27, color: colors.textTertiary, textAlign: "center" },
  crew: { flexDirection: "row", flexWrap: "wrap", columnGap: 72, rowGap: 28, paddingLeft: DETAIL_LEFT, paddingRight: TV_STAGE.safe.x, marginTop: 40 },
  crewColumn: { minWidth: 220, maxWidth: 420, gap: 6 },
  crewLabel: { ...fonts.bold, fontSize: 22, letterSpacing: 1.6, textTransform: "uppercase", color: colors.textTertiary },
  crewName: { ...fonts.medium, fontSize: 26, lineHeight: 34, color: white(0.86) },
});
