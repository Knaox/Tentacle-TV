import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  formatDuration, playbackEndsAt, releaseLabel, streamLanguages, type MediaItem,
} from "@tentacle-tv/shared";
import { CONTENT_MAX_WIDTH, FONT_FAMILY, spacing, useThemedStyles, type AppTheme } from "@/theme";

/**
 * « Informations » de la fiche — le jumeau du bloc du bureau : sortie, durée
 * et heure de fin, classification, studios, langues audio et sous-titres, en
 * deux colonnes. Une ligne sans donnée n'est pas rendue ; un bloc vide non plus.
 */
export const DetailFacts = memo(function DetailFacts({ item }: { item: MediaItem }) {
  const { t, i18n } = useTranslation("media");
  const st = useThemedStyles(makeStyles);
  const locale = i18n.language || "fr";
  const streams = item.MediaSources?.[0]?.MediaStreams ?? [];
  const facts: Array<{ key: string; label: string; value: string }> = [];

  if (item.OriginalTitle && item.OriginalTitle !== item.Name && item.Type !== "Episode") {
    facts.push({ key: "original", label: t("detailOriginalTitle"), value: item.OriginalTitle });
  }
  const released = releaseLabel(item, locale);
  if (released) facts.push({ key: "released", label: t("detailReleased"), value: released });
  const runtime = item.Type !== "Series" ? formatDuration(item.RunTimeTicks) : null;
  if (runtime) {
    const end = playbackEndsAt(item, Date.now());
    const time = end?.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    facts.push({ key: "runtime", label: t("detailRuntime"), value: time ? `${runtime} · ${t("detailEndsAt", { time })}` : runtime });
  }
  if (item.OfficialRating) facts.push({ key: "rating", label: t("detailRating"), value: item.OfficialRating });
  if (item.Studios && item.Studios.length > 0) {
    facts.push({ key: "studios", label: t("studioLabel"), value: item.Studios.map((s) => s.Name).join(", ") });
  }
  const audio = streamLanguages(streams, "Audio", locale);
  if (audio.length > 0) facts.push({ key: "audio", label: t("detailAudio"), value: audio.join(", ") });
  const subs = streamLanguages(streams, "Subtitle", locale);
  if (subs.length > 0) facts.push({ key: "subs", label: t("detailSubtitles"), value: subs.join(", ") });

  if (facts.length === 0) return null;
  return (
    <View style={st.section}>
      <Text style={st.title} accessibilityRole="header">{t("detailsSection")}</Text>
      <View style={st.grid}>
        {facts.map((f) => (
          <View key={f.key} style={st.cell}>
            <Text style={st.label}>{f.label}</Text>
            <Text style={st.value}>{f.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    section: { marginTop: spacing.xl, paddingHorizontal: spacing.screenPadding, maxWidth: CONTENT_MAX_WIDTH },
    title: { fontSize: 18, lineHeight: 23, letterSpacing: -0.4, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, marginBottom: spacing.md },
    grid: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.md },
    cell: { width: "50%", paddingRight: spacing.md },
    label: { fontSize: 10.5, letterSpacing: 0.9, textTransform: "uppercase", fontFamily: FONT_FAMILY.semibold, color: t.colors.text.quaternary },
    value: { marginTop: 2, fontSize: 14, lineHeight: 19, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
  });
