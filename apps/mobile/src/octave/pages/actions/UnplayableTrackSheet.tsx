/**
 * Octave mobile — la feuille d'un titre qui ne se lit pas (`trackPlayability.ts`, lot « ol » ; l'avis du bureau en est
 * le pendant, mêmes mots et mêmes gestes : `unplayableNotice`). Ouverte par un toucher sur une rangée grisée ou une
 * entrée de la file : elle dit pourquoi en mots simples et garde « Ajouter à une playlist » et « Favori » — le
 * serveur pourra le récupérer. Rien ne se lance, la lecture en cours continue.
 */

import { useEffect, useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CloudOff, Heart, ListPlus } from "lucide-react-native";
import { likeOverrideOf, openPlaylistChooser } from "@tentacle-tv/api-client";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { onUnavailableTrack, unplayableNotice } from "@tentacle-tv/shared/octave";
import { BottomSheet } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { showNotice } from "../env/notices";
import { useMobileTrackActions } from "../env/useMobileActionsUi";
import { Artwork } from "../ui/Artwork";
import { SheetAction } from "./SheetAction";

let current: MusicTrack | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const read = () => current;

export function openUnplayableTrack(track: MusicTrack): void {
  current = track;
  emit();
}

export function closeUnplayableTrack(): void {
  current = null;
  emit();
}

/** Lu hors React (tests, banc). */
export const unplayableTrackSnapshot = read;

function Header({ track }: { track: MusicTrack }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.art}>
        <Artwork url={track.artworkUrl} size={56} radius={8} />
      </View>
      <View style={styles.headerText}>
        <View style={styles.titleRow}>
          <CloudOff size={16} color={theme.colors.text.tertiary} />
          <Text style={[typography.subtitle, { color: theme.colors.text.primary }]} numberOfLines={1}>
            {t("unplayableTrack.title")}
          </Text>
        </View>
        <Text style={[typography.caption, { color: theme.colors.text.tertiary }]} numberOfLines={2}>
          {track.title} · {track.artists.map((a) => a.name).join(", ")}
        </Text>
      </View>
    </View>
  );
}

function Body({ track }: { track: MusicTrack }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const actions = useMobileTrackActions();
  const liked = likeOverrideOf(track.key) ?? track.favorite;
  const notice = unplayableNotice(track, { canLike: actions.canLike(track), canAddToPlaylist: actions.canAddToPlaylist(track), liked });
  const text = notice.keepKey ? `${t(notice.reasonKey)} ${t(notice.keepKey)}` : t(notice.reasonKey);
  return (
    <View style={styles.body}>
      <Text style={[typography.body, styles.text, { color: theme.colors.text.secondary }]}>{text}</Text>
      {notice.gestures.map((gesture, i) =>
        gesture === "addToPlaylist" ? (
          <SheetAction
            key={gesture}
            icon={ListPlus}
            label={t("unplayableTrack.addToPlaylist")}
            tone={i === 0 ? "accent" : undefined}
            onPress={() => {
              closeUnplayableTrack();
              openPlaylistChooser(track);
            }}
          />
        ) : (
          <SheetAction
            key={gesture}
            icon={Heart}
            label={t("unplayableTrack.like")}
            tone={i === 0 ? "accent" : undefined}
            onPress={() => {
              actions.toggleLike(track, { quiet: true });
              closeUnplayableTrack();
              showNotice("success", t("unplayableTrack.liked"));
            }}
          />
        ),
      )}
      {notice.liked ? <SheetAction icon={Heart} filled label={t("unplayableTrack.liked")} onPress={closeUnplayableTrack} /> : null}
    </View>
  );
}

export function UnplayableTrackSheet() {
  const track = useSyncExternalStore(subscribe, read, read);
  // Tout geste de lecture sur un titre illisible (rangée, file, lecteur) ouvre cette feuille.
  useEffect(() => onUnavailableTrack((touched) => (touched ? openUnplayableTrack(touched) : undefined)), []);
  return (
    <BottomSheet visible={track !== null} onClose={closeUnplayableTrack} snapPoints={[0.42, 0.6]} header={track ? <Header track={track} /> : null}>
      {track ? <Body key={track.key} track={track} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 12 },
  // La pochette d'un titre qu'on n'écoute pas : éteinte, comme sa rangée.
  art: { opacity: 0.45 },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  body: { paddingHorizontal: 4, gap: 4 },
  text: { paddingHorizontal: 16, paddingBottom: 8 },
});
