import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui";
import { typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

const TMDB_PROFILE = "https://image.tmdb.org/t/p/w185";
const SIZE = 80;

export interface BubblePerson {
  personId: number;
  name: string;
  profilePath: string | null;
  knownFor?: string[];
}

interface Props {
  person: BubblePerson;
  mode: "liked" | "suggestion";
  pending?: boolean;
  onAction: () => void;
}

/** Portrait rond + nom, avec l'action en pastille (aimer ou retirer). */
export const PersonBubble = memo(function PersonBubble({ person, mode, pending, onAction }: Props) {
  const { t } = useTranslation("reco");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const liked = mode === "liked";
  const label = liked ? t("actorsRemove", { name: person.name }) : t("actorsLike", { name: person.name });

  return (
    <View style={st.root}>
      <View style={[st.portrait, liked ? st.portraitLiked : st.portraitPlain]}>
        {person.profilePath ? (
          <Image source={{ uri: `${TMDB_PROFILE}${person.profilePath}` }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <Text style={st.initial}>{person.name.charAt(0)}</Text>
        )}
      </View>
      <View style={st.action}>
        <IconButton
          icon={liked ? "x" : "plus"}
          size={28}
          onPress={pending ? () => {} : onAction}
          accessibilityLabel={label}
          color={liked ? theme.colors.cta.brandFg : theme.colors.text.primary}
          bgColor={liked ? theme.colors.brand.violet : theme.colors.surface.s2}
        />
      </View>
      <Text style={st.name} numberOfLines={1}>{person.name}</Text>
      {!liked && person.knownFor?.[0] ? (
        <Text style={st.knownFor} numberOfLines={1}>{person.knownFor[0]}</Text>
      ) : null}
    </View>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  root: { width: SIZE + 8, alignItems: "center" as const },
  portrait: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: "hidden" as const,
    backgroundColor: t.colors.fill.soft, alignItems: "center" as const, justifyContent: "center" as const,
  },
  portraitLiked: { borderWidth: 2, borderColor: t.colors.brand.violet },
  portraitPlain: { borderWidth: 1, borderColor: t.colors.border.subtle },
  initial: { fontSize: 26, fontFamily: FONT_FAMILY.bold, color: t.colors.text.disabled },
  action: { position: "absolute" as const, top: -2, right: -2 },
  name: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.primary, marginTop: 8, textAlign: "center" as const },
  knownFor: { fontSize: 11, fontFamily: FONT_FAMILY.regular, color: t.colors.text.quaternary, marginTop: 2, textAlign: "center" as const },
});
