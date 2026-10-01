import { useQuery } from "@tanstack/react-query";

let _backendBase = "";

export function setStreamingConfigBackendUrl(url: string) {
  _backendBase = url.replace(/\/$/, "");
}

export interface StreamingConfig {
  enabled: boolean;
  mediaBaseUrl: string | null;
  jellyfinToken: string | null;
  /** Appareil jumelé : l'identifiant Jellyfin à adopter — celui que le canal
   *  de session présente pour lui (backend `deviceSessions/deviceAuth.ts`). */
  deviceId?: string;
  tokenExpired?: boolean;
}

export const STREAMING_CONFIG_QUERY_KEY = "streaming-config";

const DISABLED_CONFIG: StreamingConfig = {
  enabled: false,
  mediaBaseUrl: null,
  jellyfinToken: null,
};

/** Le serveur n'a pas répondu (réseau, ou 5xx d'un serveur à terre) : une
 *  PANNE, pas un réglage — l'appelant garde l'état qu'il tenait. */
export class StreamingConfigUnavailable extends Error {
  constructor(readonly status?: number) {
    super(status ? `streaming config: HTTP ${status}` : "streaming config: no response");
    this.name = "StreamingConfigUnavailable";
  }
}

/** Fetch one-shot de la config direct-streaming (aussi utilisé hors React Query :
 *  récupération d'un 401 de stream côté TV → redemande d'un token frais).
 *
 *  Trois issues, à ne pas confondre :
 *  - pas de réponse (réseau, 5xx) : PANNE → rejet `StreamingConfigUnavailable`.
 *    Rendre « désactivé » ici coupait le direct à chaque coupure de Tentacle —
 *    alors que Jellyfin, lui, répondait peut-être encore ;
 *  - réponse avec jeton : lecture directe ;
 *  - réponse sans jeton (`jellyfinToken: null`, ou refus 4xx) : un MODE, la
 *    lecture par le proxy. */
export async function fetchStreamingConfig(token: string | null): Promise<StreamingConfig> {
  if (!token) return DISABLED_CONFIG;

  const headers: Record<string, string> = {};
  // Real token for mobile/desktop; web uses httpOnly cookies
  if (token !== "__cookie__") {
    headers.Authorization = `Bearer ${token}`;
  }
  // token === "__cookie__" means web (use cookies); real token means desktop/mobile (use header)
  // `jellyfinAuth=modern` : ce client parle à Jellyfin en `Authorization` /
  // `ApiKey` (cf. directAuth) — le serveur peut lui confier le direct même
  // quand Jellyfin refuse l'authentification héritée (12.x).
  let res: Response;
  try {
    res = await fetch(`${_backendBase}/api/config/streaming?jellyfinAuth=modern`, {
      headers,
      credentials: token === "__cookie__" ? "include" : undefined,
    });
  } catch {
    throw new StreamingConfigUnavailable();
  }
  if (res.status >= 500) throw new StreamingConfigUnavailable(res.status);
  if (!res.ok) return DISABLED_CONFIG;
  try {
    const data = await res.json();
    return data.directStreaming ?? DISABLED_CONFIG;
  } catch {
    // Un corps illisible n'est pas une réponse : la même panne.
    throw new StreamingConfigUnavailable(res.status);
  }
}

/**
 * Fetch streaming config from backend (includes server-side health check).
 * Polls every 5 minutes to pick up admin changes without re-login.
 */
export function useStreamingConfig(token: string | null) {
  return useQuery<StreamingConfig>({
    queryKey: [STREAMING_CONFIG_QUERY_KEY, token],
    queryFn: () => fetchStreamingConfig(token),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
    enabled: !!token,
  });
}
