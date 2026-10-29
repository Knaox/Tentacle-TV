/**
 * Octave mobile — « Un album » : on cherche dans la bibliothèque (et dans ses imports), on touche un album, et TOUS
 * ses titres entrent dans la playlist, dans l'ordre de l'album. Sans frappe : les ajouts récents et vos imports. La
 * playlist neuve prend le nom de l'album (renommable ensuite).
 */

import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { musicSearchText, useImportedReleases, useMusicHome, useMusicSearch } from "@tentacle-tv/api-client";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { OctavePlayButton } from "../../../layout/OctavePlayButton";
import { useOctavePagesProvider } from "../../../pages";
import { Artwork } from "../../../pages/ui/Artwork";

const matches = (album: MusicAlbum, q: string) => musicSearchText(`${album.title} ${album.artists.map((a) => a.name).join(" ")}`).includes(q);

const AlbumRow = memo(function AlbumRow({ album, selected, onSelect }: { album: MusicAlbum; selected: boolean; onSelect: (album: MusicAlbum) => void }) {
  const { t } = useTranslation("musicImport");
  const theme = useTheme();
  const meta = [album.artists.map((a) => a.name).join(", "), album.year, album.trackCount ? t("albumTracks", { count: album.trackCount }) : null].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${album.title}, ${meta}`}
      onPress={() => {
        haptic("select");
        onSelect(album);
      }}
      style={({ pressed }) => [styles.row, (selected || pressed) && { backgroundColor: theme.colors.fill.soft }]}
    >
      <Artwork url={album.artworkUrl} size={48} radius={6} />
      <View style={styles.flex}>
        <Text numberOfLines={1} style={[typography.bodyBold, { color: theme.colors.text.primary }]}>{album.title}</Text>
        <Text numberOfLines={1} style={[typography.caption, { color: theme.colors.text.tertiary }]}>{meta}</Text>
      </View>
      {selected ? <Check size={18} color={theme.colors.brand.accentLight} /> : null}
    </Pressable>
  );
});

function Group({ label, albums, chosen, onSelect }: { label?: string; albums: readonly MusicAlbum[]; chosen: string | null; onSelect: (album: MusicAlbum) => void }) {
  const theme = useTheme();
  if (albums.length === 0) return null;
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      {label ? <Text style={[typography.small, styles.groupLabel, { color: theme.colors.text.tertiary }]}>{label}</Text> : null}
      {albums.map((album) => (
        <AlbumRow key={album.key} album={album} selected={chosen === album.key} onSelect={onSelect} />
      ))}
    </View>
  );
}

export function AlbumChoice({ into, onStart }: { into: boolean; onStart: (album: MusicAlbum) => void }) {
  const { t } = useTranslation("musicImport");
  const theme = useTheme();
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<MusicAlbum | null>(null);
  const q = musicSearchText(text);
  const search = useMusicSearch(text, { limit: 20 });
  const home = useMusicHome({ enabled: q.length === 0 });
  const imports = useImportedReleases(useOctavePagesProvider()).data?.albums;
  const { library, imported } = useMemo(() => {
    const own = (imports ?? []).filter((a) => q.length === 0 || matches(a, q)).slice(0, q.length === 0 ? 6 : 10);
    const lib = q.length > 0 ? (search.data?.albums ?? []) : (home.data?.recentlyAdded ?? []).slice(0, 12);
    return { library: lib, imported: own };
  }, [home.data, imports, q, search.data]);
  const none = q.length > 0 && !search.pending && library.length === 0 && imported.length === 0;

  return (
    <>
      <Text style={[typography.body, { color: theme.colors.text.secondary }]}>{t("albumIntro")}</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        autoCorrect={false}
        returnKeyType="search"
        placeholder={t("albumPlaceholder")}
        placeholderTextColor={theme.colors.text.quaternary}
        accessibilityLabel={t("albumSearch")}
        style={[typography.body, styles.field, { color: theme.colors.text.primary, backgroundColor: theme.colors.fill.subtle, borderColor: theme.colors.border.subtle }]}
      />
      {/* L'action AVANT la liste : elle reste à portée du pouce, la liste défile dessous. */}
      <OctavePlayButton label={t(into ? "albumStartInto" : "albumStart")} Icon={null} onPress={() => chosen && onStart(chosen)} disabled={!chosen} style={styles.primary} />
      <Group label={q.length === 0 ? t("albumRecent") : undefined} albums={library} chosen={chosen?.key ?? null} onSelect={setChosen} />
      <Group label={t("albumImports")} albums={imported} chosen={chosen?.key ?? null} onSelect={setChosen} />
      {none ? <Text style={[typography.body, styles.none, { color: theme.colors.text.tertiary }]}>{t("albumNone")}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: { minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  group: { gap: 2 },
  groupLabel: { textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 4, paddingBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 6, borderRadius: 10 },
  flex: { flex: 1, minWidth: 0 },
  none: { textAlign: "center", paddingVertical: 16 },
  primary: { marginTop: 4 },
});
