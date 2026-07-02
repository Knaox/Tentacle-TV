import { useQuery } from "@tanstack/react-query";

let _backendBase = "";

export function setConfigBackendUrl(url: string) {
  _backendBase = url.replace(/\/$/, "");
}

export interface AppFeatures {
  downloads: boolean;
  demo: boolean;
  sharedWatchlists?: boolean;
}

export interface AppConfig {
  version: string;
  brandName: string;
  features: AppFeatures;
  autoplayNextEnabled: boolean;
}

const defaultConfig: AppConfig = {
  version: "0.0.0",
  brandName: "Tentacle TV",
  features: { downloads: false, demo: false },
  autoplayNextEnabled: true,
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

export interface AutoplayConfig {
  /** Interrupteur admin « Déclenchement auto-play » (bannière épisode suivant). */
  enabled: boolean;
  /** Seuil (%) = MaxResumePct de Jellyfin : la bannière apparaît à ce % de lecture. */
  maxResumePct: number;
}

const defaultAutoplayConfig: AutoplayConfig = { enabled: true, maxResumePct: 90 };

/**
 * Config du déclenchement auto-play, POLLÉE pendant une lecture active
 * (`active=true` → refetch 30 s ; le backend cache MaxResumePct 30 s → une
 * mise à jour dans Jellyfin s'applique en ≤ ~60 s, même en cours de lecture).
 */
export function useAutoplayConfig(active: boolean) {
  return useQuery({
    queryKey: ["autoplay-config"],
    queryFn: async (): Promise<AutoplayConfig> => {
      const res = await fetch(`${_backendBase}/api/config/autoplay`);
      if (!res.ok) return defaultAutoplayConfig;
      return res.json();
    },
    staleTime: 15_000,
    refetchInterval: active ? 30_000 : false,
    retry: false,
  });
}
