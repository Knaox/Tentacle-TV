import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useTentacleConfig } from "@tentacle-tv/api-client";

import { useServerUrl } from "@/providers/ServerUrlContext";

/**
 * Version serveur minimale exigée par cette version de l'app. Embarquée dans
 * `app.json → extra.minServer` (miroir de `versions.json → minServer`, patché
 * par la CI comme le numéro de version natif). Fallback très bas = jamais
 * d'alerte si la valeur manque.
 */
const MIN_SERVER_VERSION: string =
  (Constants.expoConfig?.extra?.minServer as string | undefined) ?? "0.0.0";

/** Comparateur semver simplifié `x.y.z` → -1 | 0 | 1 (comme apps/web). */
function cmpVersion(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

interface ServerCompat {
  serverVersion: string | null;
  /** true si le serveur est plus ancien que le minimum exigé par l'app. */
  incompatible: boolean;
  /** L'utilisateur courant est-il administrateur (seul à pouvoir mettre à jour). */
  isAdmin: boolean;
}

/**
 * Détecte un serveur trop ancien pour cette app (parité web `useServerCompat`).
 * Récupère la version via `GET {serverUrl}/api/config` ; en cas d'échec réseau,
 * `serverVersion` reste null → aucune alerte (on ne devine pas).
 */
export function useServerCompat(): ServerCompat {
  const { serverUrl } = useServerUrl();
  const { storage } = useTentacleConfig();

  const isAdmin = (() => {
    try {
      const raw = storage.getItem("tentacle_user");
      return raw ? JSON.parse(raw)?.Policy?.IsAdministrator === true : false;
    } catch {
      return false;
    }
  })();

  const { data: serverVersion = null } = useQuery({
    queryKey: ["server-compat", serverUrl ?? ""],
    queryFn: async (): Promise<string | null> => {
      const res = await fetch(`${serverUrl}/api/config`);
      if (!res.ok) return null;
      const cfg = (await res.json()) as { version?: unknown };
      return cfg?.version != null ? String(cfg.version) : null;
    },
    enabled: !!serverUrl,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const incompatible =
    serverVersion != null && cmpVersion(serverVersion, MIN_SERVER_VERSION) < 0;

  return { serverVersion, incompatible, isAdmin };
}
