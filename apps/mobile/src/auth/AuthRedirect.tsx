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
 * La garde d'authentification : renvoie vers la mention légale, le choix du
 * serveur, la connexion ou l'accueil selon ce qui est enregistré. Ne rend
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
    const disclaimerAccepted = storage.getItem("disclaimer_accepted") === "true";

    if (!url) {
      // No server URL yet — show disclaimer first (once), then server-setup
      if (!disclaimerAccepted) {
        const onDisclaimer = inAuthGroup && (segments as string[])[1] === "disclaimer";
        if (!onDisclaimer) {
          router.replace("/(auth)/disclaimer");
        }
      } else {
        const onSetup = inAuthGroup && (segments as string[])[1] === "server-setup";
        if (!onSetup) {
          router.replace("/(auth)/server-setup");
        }
      }
    } else if (url && !token && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (url && token && inAuthGroup && !isSessionExpired()) {
      router.replace("/(tabs)");
    }
  }, [ready, segments, router, storage]);

  return null;
}
