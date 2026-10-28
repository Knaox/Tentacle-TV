/**
 * Octave mobile — à droite du grand titre de la bibliothèque, sur l'onglet Playlists (celui qui l'ouvre) :
 * « Importer » (coller un lien Spotify, YouTube Music, Deezer, Apple Music… : la feuille d'import de
 * `useMusicImport`, la même que sur le web et le bureau) et « + » (nouvelle playlist). Sans la capacité
 * d'import, « + » seul.
 */

import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react-native";
import { useMusicImport } from "@tentacle-tv/api-client";
import { GlassIconButton, GlassTextButton } from "../../playlists/screens/BarButtons";
import { openPlaylistSheet } from "../../playlists/sheets/playlistSheetStore";
import { useOctavePagesProvider } from "../env/pagesEnv";

export const LibraryPlaylistActions = memo(function LibraryPlaylistActions() {
  const { t: ti } = useTranslation("musicImport");
  const { t: tl } = useTranslation("musicLists");
  const importable = useMusicImport(useOctavePagesProvider()).available;
  return (
    <View style={styles.actions}>
      {importable ? <GlassTextButton label={ti("entryShort")} onPress={() => openPlaylistSheet({ kind: "import" })} /> : null}
      <GlassIconButton icon={Plus} label={tl("newTitle")} onPress={() => openPlaylistSheet({ kind: "create" })} />
    </View>
  );
});

const styles = StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
});
