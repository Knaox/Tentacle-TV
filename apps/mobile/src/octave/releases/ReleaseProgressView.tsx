/**
 * Octave mobile — la feuille pendant et après l'import : où il en est en une ligne, une barre, chaque fichier
 * avec son état en MOTS (jamais la seule couleur) ; en pause, « Reprendre » (ce qui est transféré est gardé). À la
 * fin : la pochette de l'album créé en grand et « Ouvrir l'album » ; un échec dit pourquoi, avec « Réessayer ».
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { releaseArrival, releaseFileCounts, releaseFraction, type ReleaseFlowState } from "@tentacle-tv/api-client";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { typography, useTheme } from "@/theme";
import { OctavePlayButton } from "../layout/OctavePlayButton";
import { Artwork } from "../pages/ui/Artwork";
import { sizeLabel } from "./ReleaseFormView";

interface Props {
  state: ReleaseFlowState;
  onHide: () => void;
  onCancel: () => void;
  onResume: () => void;
  onOpen: (album: MusicAlbum) => void;
  onAnother: () => void;
}

function Secondary({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.secondary}>
      <Text style={[typography.bodyBold, { color: theme.colors.text.secondary }]}>{label}</Text>
    </Pressable>
  );
}

export function ReleaseProgressView({ state, onHide, onCancel, onResume, onOpen, onAnother }: Props) {
  const { t, i18n } = useTranslation("musicReleases");
  const theme = useTheme();
  const warn = theme.colors.statusPairs.warning.fg;

  if (state.phase === "failed") {
    return (
      <>
        <Text style={[typography.body, { color: theme.colors.status.error }]} accessibilityRole="alert">
          {t(`refusal.${state.refusal ?? "failed"}`)}
        </Text>
        <OctavePlayButton label={t("retry")} Icon={null} onPress={onAnother} style={styles.primary} />
      </>
    );
  }
  if (state.phase === "done") {
    const album = releaseArrival(state.job);
    const count = state.job?.albums.length ?? 0;
    const files = releaseFileCounts(state.job);
    const counts = (
      <>
        {files.duplicate > 0 ? <Text style={[typography.caption, { color: theme.colors.text.tertiary }]}>{t("doneDuplicates", { count: files.duplicate })}</Text> : null}
        {files.refused > 0 ? <Text style={[typography.caption, { color: warn }]}>{t("doneRefused", { count: files.refused })}</Text> : null}
      </>
    );
    return album ? (
      <>
        <View style={styles.arrival}>
          <Artwork url={album.artworkUrl} size={112} radius={14} />
          <View style={styles.flex}>
            <Text numberOfLines={2} style={[typography.subtitle, { color: theme.colors.text.primary }]}>{album.title}</Text>
            <Text numberOfLines={1} style={[typography.body, { color: theme.colors.text.secondary }]}>{album.artists.map((a) => a.name).join(", ")}</Text>
            <Text style={[typography.caption, { color: theme.colors.text.tertiary }]}>{t("doneAlbums", { count })}</Text>
          </View>
        </View>
        {counts}
        <OctavePlayButton label={t("openAlbum")} Icon={null} onPress={() => onOpen(album)} style={styles.primary} />
        <Secondary label={t("another")} onPress={onAnother} />
      </>
    ) : (
      <>
        <Text style={[typography.body, { color: theme.colors.text.secondary }]}>{t("doneNothingNew")}</Text>
        {counts}
        <Secondary label={t("another")} onPress={onAnother} />
      </>
    );
  }

  const paused = state.phase === "paused";
  const files = state.job?.files ?? [];
  const current = state.sending !== null ? files[state.sending] : null;
  // L'album paraît dès que le serveur l'a lu (premier fichier d'un lot), avec sa pochette.
  const early = releaseArrival(state.job);
  const fraction = releaseFraction(state.job, state.sentBytes, state.totalBytes);
  const line = paused
    ? t("pausedHint")
    : state.source === "bandcamp"
      ? t("linkReading")
      : current
        ? t("sendingFile", { name: current.name, index: (state.sending ?? 0) + 1, total: files.length })
        : state.totalBytes > 0
          ? t("bytes", { sent: sizeLabel(state.sentBytes, i18n.language), total: sizeLabel(state.totalBytes, i18n.language) })
          : "";
  return (
    <>
      <Text style={[typography.bodyBold, { color: paused ? warn : theme.colors.text.primary }]}>{t(`phase.${state.phase}`)}</Text>
      {line ? (
        <Text accessibilityLiveRegion="polite" numberOfLines={2} style={[typography.caption, { color: theme.colors.text.tertiary }]}>
          {line}
        </Text>
      ) : null}
      {early ? (
        <View style={styles.early}>
          <Artwork url={early.artworkUrl} size={56} radius={8} />
          <View style={styles.flex}>
            <Text numberOfLines={1} style={[typography.bodyBold, { color: theme.colors.text.primary }]}>{early.title}</Text>
            <Text numberOfLines={1} style={[typography.caption, { color: theme.colors.text.tertiary }]}>{early.artists.map((a) => a.name).join(", ")}</Text>
          </View>
        </View>
      ) : null}
      <View style={[styles.track, { backgroundColor: theme.colors.fill.subtle }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}>
        <View style={[styles.bar, { width: `${Math.round(fraction * 100)}%`, backgroundColor: theme.colors.brand.accent }]} />
      </View>
      {files.map((file, i) => (
        <View key={file.uploadId} style={styles.file}>
          <Text numberOfLines={1} style={[typography.caption, styles.flex, { color: i === state.sending ? theme.colors.text.primary : theme.colors.text.secondary }]}>
            {file.name}
          </Text>
          <Text style={[typography.caption, { color: file.state === "refused" ? warn : theme.colors.text.tertiary }]}>
            {file.state === "refused" && file.refusal ? t(`refusal.${file.refusal}`) : t(`file.${file.state}`)}
          </Text>
        </View>
      ))}
      {paused ? <OctavePlayButton label={t("resume")} Icon={null} onPress={onResume} style={styles.primary} /> : <Secondary label={t("hide")} onPress={onHide} />}
      <Secondary label={t("cancel")} onPress={onCancel} />
    </>
  );
}

const styles = StyleSheet.create({
  arrival: { flexDirection: "row", alignItems: "center", gap: 16 },
  early: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  primary: { marginTop: 4 },
  secondary: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  bar: { height: 6, borderRadius: 3 },
  file: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 28 },
});
