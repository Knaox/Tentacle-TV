import { useCallback } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import { removeOfflineEntry, setLocalWatched, type OfflineEntry } from "@/offline/engineApi";
import { syncPlaybackState } from "@/offline/resync";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { useServerUrl } from "@/providers/ServerUrlContext";

/**
 * La coche « vu » des fiches locales, pour un titre ou une série entière —
 * même contrat que le bureau.
 *
 * La base locale d'abord : c'est elle que lisent le catalogue et la fiche.
 * En ligne, le serveur l'apprend dans la foulée — « vu » par la file de
 * resynchronisation, poussée ici même (date réelle comprise), « non vu » par
 * Jellyfin directement, la file n'en portant jamais. Hors ligne, même à la
 * main alors que le serveur répond, rien ne part : la file attend le retour.
 */
export function useLocalWatchedToggle(): (itemIds: readonly string[], played: boolean) => void {
  const userId = useUserId();
  const offline = useOfflineMode();
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();

  return useCallback((itemIds, played) => {
    if (userId === null) return;
    for (const itemId of itemIds) setLocalWatched(userId, itemId, played);
    if (offline) return;
    if (played) {
      const token = storage.getItem("tentacle_token");
      if (serverUrl && token) void syncPlaybackState(serverUrl, token, userId, "pending");
      return;
    }
    for (const itemId of itemIds) {
      void client.fetch(`/Users/${userId}/PlayedItems/${itemId}`, { method: "DELETE" }).catch(() => undefined);
    }
  }, [userId, offline, client, storage, serverUrl]);
}

/**
 * Retirer des titres de l'appareil, après confirmation — le fichier ne part
 * que pour ce compte (un autre compte qui l'a gardé le conserve). La fiche qui
 * l'a demandé n'a rien à faire de plus : elle se referme d'elle-même quand son
 * titre quitte la base, comme s'il était retiré depuis l'écran de gestion —
 * une navigation ici en ferait deux.
 */
export function useRemoveFromDevice(): (entries: readonly OfflineEntry[], title: string) => void {
  const { t } = useTranslation(["offline", "common"]);
  const userId = useUserId();

  return useCallback((entries, title) => {
    if (userId === null || entries.length === 0) return;
    const single = entries.length === 1;
    Alert.alert(
      single ? t("offline:removeConfirmTitle") : t("offline:bulkRemoveConfirmTitle", { count: entries.length }),
      single ? t("offline:removeConfirmMessage") : `${title}\n\n${t("offline:bulkRemoveConfirmMessage")}`,
      [
        { text: t("common:cancel"), style: "cancel" },
        {
          text: t("offline:remove"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              for (const entry of entries) await removeOfflineEntry(userId, entry.id);
            })();
          },
        },
      ],
    );
  }, [userId, t]);
}
