import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import type { StorageAdapter } from "@tentacle-tv/api-client";
import { isSessionExpired } from "./sessionState";

interface Props {
  storage: StorageAdapter;
  /** Vrai une fois le stockage hydraté : avant, rien n'est décidé. */
  ready: boolean;
}

/**
 * La garde d'authentification : renvoie vers le choix du serveur, la
 * connexion ou l'accueil selon ce qui est enregistré. La mention légale qui
 * précédait le choix du serveur a été retirée (demande de Damien,
 * 2026-10-03) ; la clé `disclaimer_accepted` d'une installation existante
 * reste en place, inerte. Ne rend
 * rien. Composant à part, et non effet de la racine : `useSegments` fait
 * re-rendre son hôte à CHAQUE navigation — la racine l'était, et avec elle
 * toute l'app, chaque consommateur de ses contextes compris.
 */
export function AuthRedirect({ storage, ready }: Props) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;

    const inAuthGroup = segments[0] === "(auth)";
    const url = storage.getItem("tentacle_server_url");
    const token = storage.getItem("tentacle_token");

    if (!url) {
      const onSetup = inAuthGroup && (segments as string[])[1] === "server-setup";
      if (!onSetup) router.replace("/(auth)/server-setup");
    } else if (url && !token && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (url && token && inAuthGroup && !isSessionExpired()) {
      router.replace("/(tabs)");
    }
  }, [ready, segments, router, storage]);

  return null;
}
