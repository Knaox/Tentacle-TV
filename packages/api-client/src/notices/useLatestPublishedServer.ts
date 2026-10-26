import { useQuery } from "@tanstack/react-query";
import { parseServerVersion } from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";

/**
 * La dernière version du serveur PUBLIÉE, telle que le rapport de la carte
 * « Serveur Tentacle » la connaît (`/api/admin/server-update` → `latest`,
 * gardée six heures par le serveur : aucun appel à GitHub ici). Sert le
 * plafond de l'invitation aux nouveautés (`serverNewsNotice`) : on n'annonce
 * jamais une version qui n'est pas sortie.
 *
 * `undefined` tant qu'elle n'est pas lue ; `null` si on ne la sait pas (serveur
 * d'avant cette route, GitHub muet, session sans le droit).
 */

export const LATEST_PUBLISHED_SERVER_KEY = ["notices", "latest-published-server"] as const;

/** Règle pure : la version publiée d'un rapport, ou `null`. */
export function readLatestPublished(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const latest = (raw as { latest?: unknown }).latest;
  if (!latest || typeof latest !== "object") return null;
  const version = (latest as { version?: unknown }).version;
  return typeof version === "string" && parseServerVersion(version) ? version : null;
}

export function useLatestPublishedServer(options: { enabled: boolean }): string | null | undefined {
  const query = useQuery<string | null>({
    queryKey: LATEST_PUBLISHED_SERVER_KEY,
    queryFn: async () => {
      try {
        return readLatestPublished(await tentacleApiFetch<unknown>("/api/admin/server-update"));
      } catch {
        return null;
      }
    },
    enabled: options.enabled,
    staleTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  return options.enabled ? query.data : null;
}
