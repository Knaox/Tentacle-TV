import { useQuery } from "@tanstack/react-query";

let _backendBase = "";

export function setStreamingConfigBackendUrl(url: string) {
  _backendBase = url.replace(/\/$/, "");
}

export interface StreamingConfig {
  enabled: boolean;
  mediaBaseUrl: string | null;
  jellyfinToken: string | null;
  tokenExpired?: boolean;
}

export const STREAMING_CONFIG_QUERY_KEY = "streaming-config";

const DISABLED_CONFIG: StreamingConfig = {
  enabled: false,
  mediaBaseUrl: null,
  jellyfinToken: null,
};

async function fetchStreamingConfig(token: string | null): Promise<StreamingConfig> {
  if (!token) return DISABLED_CONFIG;

  try {
    const headers: Record<string, string> = {};
    // Real token for mobile/desktop; web uses httpOnly cookies
    if (token !== "__cookie__") {
      headers.Authorization = `Bearer ${token}`;
    }
    // token === "__cookie__" means web (use cookies); real token means desktop/mobile (use header)
    const res = await fetch(`${_backendBase}/api/config/streaming`, {
      headers,
      credentials: token === "__cookie__" ? "include" : undefined,
    });
    if (!res.ok) return DISABLED_CONFIG;
    const data = await res.json();
    return data.directStreaming ?? DISABLED_CONFIG;
  } catch {
    return DISABLED_CONFIG;
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
