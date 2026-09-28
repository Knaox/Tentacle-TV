import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { cardRatingFor, itemMeta, matchReason, personMeta, type SearchPersonHit, type SearchTopHit } from "@tentacle-tv/shared";
import { ProgressBar } from "@/components/ui";
import { CardMarkerLayer } from "@/components/cards/CardMarkerLayer";
import { cardProgress } from "@/components/cards/cardProgress";
import { useCardSheetOpener } from "@/components/cards/sheet/cardSheetContext";
import { posterSheetTarget } from "@/components/cards/sheet/cardSheetTarget";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { PersonAvatar } from "./SearchPeople";
import { asMediaItem } from "./SearchSection";

interface Props {
  top: SearchTopHit;
  onOpen: (id: string) => void;
  onPlay: (id: string) => void;
  onPerson: (person: SearchPersonHit) => void;
}

/** Ce qui se lance tel quel ; une série ou une collection s'ouvre d'abord. */
const PLAYABLE = new Set(["Movie", "Episode"]);

/**
 * Le meilleur résultat, mis en avant — celui du bureau : l'affiche, ce qu'est
 * le titre (« Film · 2019 · ★ 7,1 »), pourquoi il répond (« Avec Tom
 * Hanks »), et le geste principal : « Lire » (ou « Reprendre ») pour un film,
 * « Détails » sinon. Une personne ouvre sa filmographie. L'affiche porte les
 * marqueurs de toutes les cartes, et son appui long la feuille des cartes.
 */
export const TopResultCard = memo(function TopResultCard({ top, onOpen, onPlay, onPerson }: Props) {
  const { t, i18n } = useTranslation("search");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const openSheet = useCardSheetOpener();

  if (top.kind === "person") {
    const person = top.hit;
    return (
      <View style={st.card}>
        <Text style={st.kicker}>{t("topResult")}</Text>
        <Pressable onPress={() => onPerson(person)} accessibilityRole="button" style={({ pressed }) => [st.body, pressed && st.pressed]}>
          <PersonAvatar person={person} size={92} />
          <View style={st.text}>
            <Text style={st.title} numberOfLines={2}>{person.name}</Text>
            <Text style={st.meta} numberOfLines={2}>{personMeta(t, person)}</Text>
            <View style={[st.cta, st.ctaSecondary, st.personCta]}>
              <Feather name="film" size={15} color={theme.colors.text.primary} />
              <Text style={st.ctaSecondaryTxt}>{t("filmography")}</Text>
            </View>
          </View>
        </Pressable>
      </View>
    );
  }

  const { item, match } = top.hit;
  const media = asMediaItem(item);
  const progress = cardProgress(media);
  const reason = matchReason(t, match);
  const playable = PLAYABLE.has(item.Type);
  const resume = (item.UserData?.PlayedPercentage ?? 0) > 0 && !item.UserData?.Played;
  const poster = item.ImageTags?.Primary
    ? client.getImageUrl(item.Id, "Primary", { height: 360, quality: 85 })
    : null;

  return (
    <View style={st.card}>
      <Text style={st.kicker}>{t("topResult")}</Text>
      <View style={st.body}>
        <Pressable
          onPress={() => onOpen(item.Id)}
          onLongPress={openSheet ? () => openSheet(posterSheetTarget(media)) : undefined}
          accessibilityRole="imagebutton"
          accessibilityLabel={item.Name}
          style={st.poster}
        >
          {poster && <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessible={false} />}
          {progress !== null && (
            <View style={st.progress}>
              <ProgressBar progress={progress / 100} height={3} />
            </View>
          )}
          <CardMarkerLayer item={media} communityRating={cardRatingFor(media, "series").rating} liftRating={progress !== null} />
        </Pressable>
        <View style={st.text}>
          <Text style={st.meta} numberOfLines={1}>{itemMeta(t, item, i18n.language)}</Text>
          <Text style={st.title} numberOfLines={2}>{item.Name}</Text>
          {reason && <Text style={st.reason} numberOfLines={1}>{reason}</Text>}
          <View style={st.actions}>
            {playable && (
              <Pressable
                onPress={() => onPlay(item.Id)}
                accessibilityRole="button"
                style={({ pressed }) => [st.cta, st.ctaPrimary, pressed && st.pressed]}
              >
                <Feather name="play" size={15} color={theme.colors.cta.primaryFg} />
                <Text style={st.ctaPrimaryTxt}>{resume ? t("resume") : t("play")}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => onOpen(item.Id)}
              accessibilityRole="button"
              style={({ pressed }) => [st.cta, playable ? st.ctaSecondary : st.ctaPrimary, pressed && st.pressed]}
            >
              <Feather name="info" size={15} color={playable ? theme.colors.text.primary : theme.colors.cta.primaryFg} />
              <Text style={playable ? st.ctaSecondaryTxt : st.ctaPrimaryTxt}>{t("details")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      marginHorizontal: spacing.screenPadding,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.faint,
    },
    kicker: {
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: "uppercase" as const,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.tertiary,
      marginBottom: spacing.sm,
    },
    body: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md },
    pressed: { opacity: 0.75 },
    poster: {
      width: 92,
      height: 138,
      borderRadius: RADIUS.md,
      overflow: "hidden" as const,
      backgroundColor: t.colors.surface.s2,
    },
    progress: { position: "absolute" as const, left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingBottom: 6 },
    text: { flex: 1, gap: 4 },
    meta: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    title: { fontSize: 20, lineHeight: 24, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, letterSpacing: -0.3 },
    reason: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: t.colors.brand.light },
    actions: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginTop: 8 },
    cta: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: RADIUS.pill,
    },
    ctaPrimary: { backgroundColor: t.colors.cta.primaryBg },
    ctaPrimaryTxt: { fontSize: 14, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.primaryFg },
    ctaSecondary: { backgroundColor: t.colors.fill.soft, borderWidth: 1, borderColor: t.colors.border.subtle },
    personCta: { marginTop: 4, alignSelf: "flex-start" as const },
    ctaSecondaryTxt: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
  });
