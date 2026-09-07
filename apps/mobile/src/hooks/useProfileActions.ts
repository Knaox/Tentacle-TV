import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import { clearCredentials } from "@/auth/credentialManager";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { forgetAvatar } from "@/offline/avatarCache";
import { removeOfflineEntry } from "@/offline/engineApi";
import { stopOfflineRuntime } from "@/offline/engineRuntime";
import { useServerUrl } from "@/providers/ServerUrlContext";

/**
 * L'identité affichée par le profil et ses quatre actions de compte
 * (déconnexion, changement de serveur, remise à zéro locale, suppression du
 * compte), sorties de l'écran pour qu'il ne soit plus qu'une mise en page.
 * Chaque action destructive passe par une confirmation ; la suppression est
 * refusée à un administrateur (le serveur le refuse aussi, 403).
 *
 * Les titres gardés sur l'appareil ne sont JAMAIS emportés par « Vider le
 * cache » (réglages remis à zéro, fichiers et base intacts) ; « Changer de
 * serveur » propose de les retirer, puisqu'ils resteront invisibles ailleurs.
 */
export function useProfileActions() {
  const { t } = useTranslation(["profile", "offline"]);
  const router = useRouter();
  const userId = useUserId();
  const { data: offlineEntries } = useOfflineList(userId);
  const { logout, changeServer } = useAuth();
  const { storage } = useTentacleConfig();
  const { setServerUrl } = useServerUrl();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  const user = (() => {
    try { const raw = storage.getItem("tentacle_user"); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  })();
  const isAdmin = user?.Policy?.IsAdministrator === true;
  const userName: string = user?.Name ?? t("profile:defaultUsername");
  const initial = userName.charAt(0).toUpperCase();
  const serverUrl = storage.getItem("tentacle_server_url") ?? "";

  // Sans serveur (hors ligne), la révocation échoue : on purge quand même la
  // session locale — comme le voile hors ligne — sinon « Se déconnecter » ne
  // ferait rien.
  const handleLogout = useCallback(() => {
    const leave = () => { clearCredentials(storage); router.replace("/(auth)/login"); };
    logout.mutate(undefined, {
      onSuccess: leave,
      onError: () => {
        storage.removeItem("tentacle_token");
        storage.removeItem("tentacle_user");
        leave();
      },
    });
  }, [logout, storage, router]);

  const handleChangeServer = useCallback(() => {
    const leave = (): void => {
      if (userId) forgetAvatar(userId);
      stopOfflineRuntime();
      changeServer.mutate(undefined, {
        onSettled: () => { setServerUrl(null); router.replace("/(auth)/server-setup"); },
      });
    };
    const count = offlineEntries?.length ?? 0;
    if (count === 0 || !userId) {
      Alert.alert(t("profile:changeServerTitle"), t("profile:changeServerMessage"), [
        { text: t("profile:clearCacheCancel"), style: "cancel" },
        { text: t("profile:changeServerConfirm"), style: "destructive", onPress: leave },
      ]);
      return;
    }
    // Des titres liés à ce serveur : les garder (invisibles ailleurs) ou les retirer.
    const removeAllThenLeave = async (): Promise<void> => {
      for (const entry of offlineEntries ?? []) {
        try { await removeOfflineEntry(userId, entry.id); } catch { /* le suivant */ }
      }
      leave();
    };
    Alert.alert(t("profile:changeServerTitle"), t("offline:changeServerWithTitlesMessage", { count }), [
      { text: t("profile:clearCacheCancel"), style: "cancel" },
      { text: t("offline:changeServerKeepTitles"), onPress: leave },
      { text: t("offline:changeServerRemoveTitles"), style: "destructive", onPress: () => { void removeAllThenLeave(); } },
    ]);
  }, [t, changeServer, setServerUrl, router, userId, offlineEntries]);

  // Réglages d'appareil remis à zéro — jamais les fichiers ni la base locale.
  const handleClearCache = useCallback(() => {
    Alert.alert(t("profile:clearCacheTitle"), `${t("profile:clearCacheMessage")}\n\n${t("offline:clearCacheKeepsTitles")}`, [
      { text: t("profile:clearCacheCancel"), style: "cancel" },
      { text: t("profile:clearCacheConfirm"), style: "destructive",
        onPress: () => { stopOfflineRuntime(); storage.clear?.(); queryClient.clear(); router.replace("/(auth)/server-setup"); },
      },
    ]);
  }, [t, queryClient, router, storage]);

  const handleDeleteAccount = useCallback(() => {
    if (isAdmin) { Alert.alert(t("profile:deleteAccountTitle"), t("profile:deleteAccountAdminError")); return; }
    Alert.alert(t("profile:deleteAccountTitle"), t("profile:deleteAccountMessage"), [
      { text: t("profile:deleteAccountCancel"), style: "cancel" },
      { text: t("profile:deleteAccountConfirm"), style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            const token = storage.getItem("tentacle_token");
            if (!serverUrl || !token) return;
            const res = await fetch(`${serverUrl}/api/auth/account`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
            if (res.status === 403) { Alert.alert(t("profile:deleteAccountTitle"), t("profile:deleteAccountAdminError")); return; }
            if (!res.ok) { Alert.alert(t("profile:deleteAccountTitle"), t("profile:deleteAccountError")); return; }
            storage.clear?.(); queryClient.clear(); router.replace("/(auth)/server-setup");
          } catch { Alert.alert(t("profile:deleteAccountTitle"), t("profile:deleteAccountError")); }
          finally { setDeleting(false); }
        },
      },
    ]);
  }, [t, isAdmin, storage, serverUrl, queryClient, router]);

  return { user, isAdmin, userName, initial, serverUrl, deleting, handleLogout, handleChangeServer, handleClearCache, handleDeleteAccount };
}
