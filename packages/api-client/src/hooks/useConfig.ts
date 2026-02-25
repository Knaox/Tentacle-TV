import { useQuery } from "@tanstack/react-query";

let _backendBase = "";

export function setConfigBackendUrl(url: string) {
  _backendBase = url.replace(/\/$/, "");
}

export interface AppFeatures {
  seerr: boolean;
  requests: boolean;
  discover: boolean;
  downloads: boolean;
  demo: boolean;
}

export interface AppConfig {
  version: string;
  brandName: string;
  features: AppFeatures;
}

const defaultConfig: AppConfig = {
  version: "0.0.0",
  brandName: "Tentacle",
  features: { seerr: false, requests: false, discover: false, downloads: false, demo: false },
};

export function useAppConfig() {
  return useQuery({
    queryKey: ["app-config"],
    queryFn: async (): Promise<AppConfig> => {
      const res = await fetch(`${_backendBase}/api/config`);
      if (!res.ok) return defaultConfig;
      return res.json();
    },
    staleTime: 5 * 60_000, // refresh every 5 min
    retry: false,
  });
}
