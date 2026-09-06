import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useTentacleConfig } from "@tentacle-tv/api-client";
import { clearCredentials } from "@/auth/credentialManager";
import { useServerUrl } from "@/providers/ServerUrlContext";

/**
 * L'identité affichée par le profil et ses quatre actions de compte
 * (déconnexion, changement de serveur, remise à zéro locale, suppression du
 * compte), sorties de l'écran pour qu'il ne soit plus qu'une mise en page.
 * Chaque action destructive passe par une confirmation ; la suppression est
 * refusée à un administrateur (le serveur le refuse aussi, 403).
 */
export function useProfileActions() {
  const { t } = useTranslation("profile");
  const router = useRouter();
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
  const userName: string = user?.Name ?? t("defaultUsername");
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
    Alert.alert(t("changeServerTitle"), t("changeServerMessage"), [
      { text: t("clearCacheCancel"), style: "cancel" },
      { text: t("changeServerConfirm"), style: "destructive",
        onPress: () => changeServer.mutate(undefined, {
          onSettled: () => { setServerUrl(null); router.replace("/(auth)/server-setup"); },
        }),
      },
    ]);
  }, [t, changeServer, setServerUrl, router]);

  const handleClearCache = useCallback(() => {
    Alert.alert(t("clearCacheTitle"), t("clearCacheMessage"), [
      { text: t("clearCacheCancel"), style: "cancel" },
      { text: t("clearCacheConfirm"), style: "destructive",
        onPress: () => { storage.clear?.(); queryClient.clear(); router.replace("/(auth)/server-setup"); },
      },
    ]);
  }, [t, queryClient, router, storage]);

  const handleDeleteAccount = useCallback(() => {
    if (isAdmin) { Alert.alert(t("deleteAccountTitle"), t("deleteAccountAdminError")); return; }
    Alert.alert(t("deleteAccountTitle"), t("deleteAccountMessage"), [
      { text: t("deleteAccountCancel"), style: "cancel" },
      { text: t("deleteAccountConfirm"), style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            const token = storage.getItem("tentacle_token");
            if (!serverUrl || !token) return;
            const res = await fetch(`${serverUrl}/api/auth/account`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
            if (res.status === 403) { Alert.alert(t("deleteAccountTitle"), t("deleteAccountAdminError")); return; }
            if (!res.ok) { Alert.alert(t("deleteAccountTitle"), t("deleteAccountError")); return; }
            storage.clear?.(); queryClient.clear(); router.replace("/(auth)/server-setup");
          } catch { Alert.alert(t("deleteAccountTitle"), t("deleteAccountError")); }
          finally { setDeleting(false); }
        },
      },
    ]);
  }, [t, isAdmin, storage, serverUrl, queryClient, router]);

  return { user, isAdmin, userName, initial, serverUrl, deleting, handleLogout, handleChangeServer, handleClearCache, handleDeleteAccount };
}
