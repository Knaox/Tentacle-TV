import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import type { StorageAdapter } from "@tentacle-tv/api-client";
import { isSessionExpired } from "./sessionState";
import { resolveAuthRoute } from "./authRoute";
import { STORED_USER_KEY } from "./storedUser";

interface Props {
  storage: StorageAdapter;
  /** Vrai une fois le stockage hydraté : avant, rien n'est décidé. */
  ready: boolean;
}

/**
 * La garde d'authentification : renvoie vers le choix du serveur, la
 * connexion ou l'accueil selon ce qui est enregistré (la décision :
 * `resolveAuthRoute`). La mention légale qui précédait le choix du serveur a
 * été retirée (demande de Damien, 2026-10-03) ; la clé `disclaimer_accepted`
 * d'une installation existante reste en place, inerte. Ne rend rien.
 * Composant à part, et non effet de la racine : `useSegments` fait re-rendre
 * son hôte à CHAQUE navigation — la racine l'était, et avec elle toute l'app,
 * chaque consommateur de ses contextes compris.
 */
export function AuthRedirect({ storage, ready }: Props) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const route = resolveAuthRoute({
      segments,
      serverUrl: storage.getItem("tentacle_server_url"),
      token: storage.getItem("tentacle_token"),
      user: storage.getItem(STORED_USER_KEY),
      sessionExpired: isSessionExpired(),
    });
    if (route) router.replace(route);
  }, [ready, segments, router, storage]);

  return null;
}
