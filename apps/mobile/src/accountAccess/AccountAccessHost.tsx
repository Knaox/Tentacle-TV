import { useCallback, useEffect, type ReactNode } from "react";
import { Platform } from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import { usePathname, useRouter } from "expo-router";
import { reportAccountAccess, useAccountAccess, useAuth, useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import { clearCredentials } from "@/auth/credentialManager";
import { stopOfflineRuntime } from "@/offline/engineRuntime";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { accountAccessActions, isPlaybackRoute, type AccountAccessAction } from "./accountAccessModel";
import { AccountAccessScreen } from "./AccountAccessScreen";
import { useEndProfileSessionForAccess, useIsProfileSession } from "./profileSessionAdapter";

/**
 * La porte de l'accès du compte sur le mobile (docs/DROITS-UTILISATEURS.md
 * § 9.1, § 9.10) — la règle de tous les clients (`useAccountAccess`) : compte
 * DÉSACTIVÉ ou HORS DE SES HEURES (contrôle parental à horaires), la page
 * remplace l'application, au-dessus de tout, et le lecteur se ferme — une
 * lecture en cours est COUPÉE à l'heure limite et ne redémarre pas (le serveur
 * refuse aussi chaque flux, et garde la position par la clé d'administration).
 * Revenu dans ses heures, la page se lève seule. Monté une fois, à la racine.
 */
export function AccountAccessHost() {
  const userId = useUserId();
  const page = useAccountAccess({ enabled: userId !== null });
  const pathname = usePathname();
  const router = useRouter();
  const profileSession = useIsProfileSession();
  const endProfileSession = useEndProfileSessionForAccess();
  const { logout, changeServer } = useAuth();
  const { storage } = useTentacleConfig();
  const { setServerUrl } = useServerUrl();

  useEffect(() => {
    if (page && isPlaybackRoute(pathname)) router.replace("/(tabs)");
  }, [page, pathname, router]);

  const run = useCallback((action: AccountAccessAction) => {
    // La page se lève : l'état bloqué n'appartient pas à la session qui vient.
    const leave = () => reportAccountAccess({ state: "allowed" });
    if (action === "switchProfile") {
      leave();
      endProfileSession();
      return;
    }
    if (action === "changeServer") {
      stopOfflineRuntime();
      changeServer.mutate(undefined, {
        onSettled: () => { leave(); setServerUrl(null); router.replace("/(auth)/server-setup"); },
      });
      return;
    }
    const toLogin = () => { leave(); clearCredentials(storage); router.replace("/(auth)/login"); };
    logout.mutate(undefined, {
      onSuccess: toLogin,
      onError: () => {
        storage.removeItem("tentacle_token");
        storage.removeItem("tentacle_user");
        toLogin();
      },
    });
  }, [changeServer, endProfileSession, logout, router, setServerUrl, storage]);

  if (!page) return null;
  return (
    <AboveEverything>
      <AccountAccessScreen page={page} actions={accountAccessActions(profileSession)} onAction={run} />
    </AboveEverything>
  );
}

/** Le lecteur est une modale NATIVE sur iOS : la page passe par une `FullWindowOverlay` (patron de la migration). */
function AboveEverything({ children }: { children: ReactNode }) {
  return Platform.OS === "ios" ? <FullWindowOverlay>{children}</FullWindowOverlay> : <>{children}</>;
}
