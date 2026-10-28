/**
 * Octave (mobile) — l'en-tête du lecteur plein écran : « Lu depuis la playlist » et son nom, comme Apple Music.
 * Un toucher ferme le lecteur et ouvre la page (la règle : `nowPlayingSource`) ; déjà sur cette page, il ferme
 * seulement le lecteur. Rien où aller : « En cours de lecture », sans bouton.
 */

import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";
import { externalEntityKey, useMusicPlaylists } from "@tentacle-tv/api-client";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import type { ExternalMusicPlaylist } from "@tentacle-tv/shared/music";
import { usePlayerSelector } from "../OctavePlayerContext";
import { closeNowPlaying } from "../nowPlayingStore";
import { useOctaveColors } from "../../theme/octaveColors";
import { nowPlayingSource, sourceKickerKey, type NowPlayingSource } from "./nowPlayingSource";

function pathOf(source: NowPlayingSource): string {
  switch (source.kind) {
    case "album": return octavePaths.album(source.target);
    case "playlist": return octavePaths.playlist(source.id);
    case "externalPlaylist": return octavePaths.externalPlaylist(source.key);
    case "artist": return octavePaths.artist(source.target);
    case "liked": return octavePaths.liked;
    case "mood": return octavePaths.mood(source.id);
  }
}

/** Le nom à afficher : ce que la règle sait, sinon ce que le cache des pages sait déjà (aucune requête de plus qu'une liste). */
function useSourceName(source: NowPlayingSource | null): string | null {
  const { t } = useTranslation("music");
  const qc = useQueryClient();
  const playlists = useMusicPlaylists({ enabled: source?.kind === "playlist" });
  if (source === null) return null;
  switch (source.kind) {
    case "album":
    case "artist": return source.name;
    case "playlist": return playlists.data?.find((p) => p.jellyfinId === source.id)?.name ?? null;
    case "externalPlaylist": return qc.getQueryData<ExternalMusicPlaylist>(externalEntityKey("playlist", source.key))?.title ?? null;
    case "liked": return t("nowPlayingSource.likedName");
    case "mood": return null;
  }
}

export const NowPlayingSourceButton = memo(function NowPlayingSourceButton() {
  const { t } = useTranslation("music");
  const colors = useOctaveColors();
  const router = useRouter();
  const pathname = usePathname();
  const contextId = usePlayerSelector((s) => s.queue.contextId);
  const album = usePlayerSelector((s) => s.current?.album ?? null);
  const artists = usePlayerSelector((s) => s.current?.artists);
  const source = nowPlayingSource(contextId, album || artists ? { album, artists: artists ?? [] } : null);
  const name = useSourceName(source);
  const open = useCallback(() => {
    if (source === null) return;
    closeNowPlaying();
    const path = pathOf(source);
    // Déjà sur la page : le lecteur se referme dessus, sans l'empiler une seconde fois.
    if (decodeURIComponent(pathname) !== decodeURIComponent(path)) router.push(path as never);
  }, [router, pathname, source]);

  if (source === null) {
    return <Text style={[styles.kicker, { color: colors.textSecondary }]}>{t("queue.nowPlaying")}</Text>;
  }
  const kicker = t(sourceKickerKey(source));
  return (
    <Pressable
      onPress={open}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.pressed }]}
      accessibilityRole="link"
      accessibilityLabel={name ? `${kicker} ${name}` : kicker}
      accessibilityHint={t("nowPlayingSource.openHint")}
    >
      <View style={styles.lines}>
        <Text numberOfLines={1} style={[styles.kicker, { color: colors.textSecondary }]}>{kicker}</Text>
        {name ? <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{name}</Text> : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: { flexShrink: 1, minHeight: 44, minWidth: 44, paddingHorizontal: 12, borderRadius: 14, justifyContent: "center" },
  lines: { alignItems: "center", gap: 1 },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", textAlign: "center" },
  name: { fontSize: 15, fontWeight: "700", textAlign: "center" },
});
