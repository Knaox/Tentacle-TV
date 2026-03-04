import { useQuery } from "@tanstack/react-query";

let _backendBase = "";

export function setStreamingConfigBackendUrl(url: string) {
  _backendBase = url.replace(/\/$/, "");
}

export interface StreamingConfig {
  enabled: boolean;
  mediaBaseUrl: string | null;
  jellyfinToken: string | null;
}

const DISABLED_CONFIG: StreamingConfig = {
  enabled: false,
  mediaBaseUrl: null,
  jellyfinToken: null,
};

async function fetchStreamingConfig(token: string | null): Promise<StreamingConfig> {
  if (!token) return DISABLED_CONFIG;

  try {
    const res = await fetch(`${_backendBase}/api/config/streaming`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return DISABLED_CONFIG;
    const data = await res.json();
    return data.directStreaming ?? DISABLED_CONFIG;
  } catch {
    return DISABLED_CONFIG;
  }
}

async function healthCheck(mediaBaseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${mediaBaseUrl}/System/Info/Public`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch streaming config from backend and validate with health check.
 * Polls every 5 minutes to pick up admin changes without re-login.
 */
export function useStreamingConfig(token: string | null) {
  return useQuery<StreamingConfig>({
    queryKey: ["streaming-config", token],
    queryFn: async (): Promise<StreamingConfig> => {
      const config = await fetchStreamingConfig(token);
      if (!config.enabled || !config.mediaBaseUrl) return DISABLED_CONFIG;

      const reachable = await healthCheck(config.mediaBaseUrl);
      if (!reachable) {
        console.warn("[DirectStreaming] Health check failed, falling back to proxy");
        return DISABLED_CONFIG;
      }

      return config;
    },
    staleTime: 5 * 60_000, // re-fetch every 5 min
    gcTime: 30 * 60_000,
    retry: false,
    enabled: !!token,
  });
}
