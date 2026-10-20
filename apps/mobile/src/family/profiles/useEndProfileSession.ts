import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { switchWtSession, useTentacleConfig } from "@tentacle-tv/api-client";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { endMobileProfileSession } from "./switchSession";

/**
 * Mettre fin à la session de PROFIL de l'appareil (un profil que le serveur
 * refuse : compte désactivé, hors de ses heures — `accountAccess/`) : retour en
 * coulisse à la session personnelle, l'app repart à l'accueil, puis « Qui
 * regarde ? » exigé — jamais le compte ouvert sans son code, jamais une
 * déconnexion. Rend faux hors d'une session de profil (l'appelant fait comme avant).
 */
export function useEndProfileSession(): (reason: string) => boolean {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  const queryClient = useQueryClient();
  const router = useRouter();
  return useCallback((reason: string) => {
    if (!serverUrl) return false;
    if (!endMobileProfileSession({ storage, serverUrl, clearCache: () => queryClient.clear(), followSession: switchWtSession }, reason)) return false;
    router.replace("/(tabs)" as never);
    return true;
  }, [storage, serverUrl, queryClient, router]);
}
