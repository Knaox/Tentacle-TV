/**
 * Octave mobile — gérer une playlist et en retirer des titres : les gestes partagés du bureau
 * (`usePlaylistManageGestures`, `usePlaylistRemoval`, api-client), avec l'extension, les avis et la pile du
 * mobile. Supprimer la playlist ouverte ramène à « Playlists » ; la suppression se confirme (feuille native,
 * bouton rouge), un retrait non : son avis porte « Annuler ».
 */

import { useCallback } from "react";
import { Alert } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { usePlaylistManageGestures, usePlaylistRemoval, type PlaylistTarget } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { useMobileActionsUi, useOctavePagesProvider } from "../../pages";
import { haptic } from "@/utils/haptics";

export function useMobilePlaylistManage() {
  const { t } = useTranslation("music");
  const router = useRouter();
  const pathname = usePathname();
  const ui = useMobileActionsUi();
  const onDeleted = useCallback(
    (playlist: MusicPlaylist) => {
      if (pathname === octavePaths.playlist(playlist.jellyfinId)) {
        if (router.canGoBack()) router.back();
        else router.replace(octavePaths.playlists as never);
      }
    },
    [pathname, router],
  );
  const onDuplicated = useCallback((id: string) => router.push(octavePaths.playlist(id) as never), [router]);
  const manage = usePlaylistManageGestures(useOctavePagesProvider(), ui, { onDeleted, onDuplicated });
  const { deletePlaylist, waitingCount } = manage;

  /** Supprimer, après confirmation : ce qui arrive aux titres en attente est dit avant. */
  const confirmDelete = useCallback(
    (playlist: MusicPlaylist) => {
      const waiting = waitingCount(playlist);
      Alert.alert(
        t("playlistManage.deleteTitle", { name: playlist.name }),
        waiting > 0 ? t("playlistManage.deleteMessageWaiting", { count: waiting }) : t("playlistManage.deleteMessage"),
        [
          { text: t("playlistManage.cancel"), style: "cancel" },
          {
            text: t("playlistManage.deleteConfirm"),
            style: "destructive",
            onPress: () => {
              haptic("destructive");
              void deletePlaylist(playlist);
            },
          },
        ],
      );
    },
    [deletePlaylist, t, waitingCount],
  );

  return { ...manage, confirmDelete };
}

/** Retirer des titres de cette playlist (le « – » du mode Modifier), avec « Annuler » dans l'avis. */
export function useMobilePlaylistRemoval(target: PlaylistTarget | null) {
  return usePlaylistRemoval(useOctavePagesProvider(), target, useMobileActionsUi());
}
