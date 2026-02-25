import { createContext, useContext, useState, useEffect, createElement } from "react";
import type { StorageAdapter } from "./storage";

// ── Types ──

export interface SeerrConfig {
  url: string;
  apiKey: string;
}

export interface AppMode {
  platform: "web" | "desktop" | "mobile" | "tv";
  isStandalone: boolean;
  hasBackend: boolean;
  seerr: SeerrConfig | null;
}

export interface AppModeProviderProps {
  platform: "web" | "desktop" | "mobile" | "tv";
  backendUrl: string;
  storage: StorageAdapter;
  children: React.ReactNode;
}

// ── Storage keys ──

const SEERR_URL_KEY = "tentacle_seerr_url";
const SEERR_API_KEY_KEY = "tentacle_seerr_api_key";

// ── Context ──

const AppModeContext = createContext<AppMode | null>(null);

export function useAppMode(): AppMode {
  const ctx = useContext(AppModeContext);
  if (!ctx) {
    throw new Error("useAppMode must be used within AppModeProvider");
  }
  return ctx;
}

// ── Helpers ──

function readSeerrConfig(storage: StorageAdapter): SeerrConfig | null {
  const url = storage.getItem(SEERR_URL_KEY);
  const apiKey = storage.getItem(SEERR_API_KEY_KEY);
  if (url && apiKey) return { url: url.replace(/\/$/, ""), apiKey };
  return null;
}

export function saveSeerrConfig(storage: StorageAdapter, url: string, apiKey: string): void {
  storage.setItem(SEERR_URL_KEY, url.replace(/\/$/, ""));
  storage.setItem(SEERR_API_KEY_KEY, apiKey);
}

export function clearSeerrConfig(storage: StorageAdapter): void {
  storage.removeItem(SEERR_URL_KEY);
  storage.removeItem(SEERR_API_KEY_KEY);
}

// ── Provider ──

export function AppModeProvider({ platform, backendUrl, storage, children }: AppModeProviderProps) {
  const isWeb = platform === "web";
  const [hasBackend, setHasBackend] = useState(isWeb && !!backendUrl);
  const [seerr, setSeerr] = useState<SeerrConfig | null>(() => readSeerrConfig(storage));

  // For non-web platforms, optionally probe backend health
  useEffect(() => {
    if (isWeb || !backendUrl) return;
    const ctrl = new AbortController();
    fetch(`${backendUrl}/api/health`, { signal: ctrl.signal })
      .then((r) => { if (r.ok) setHasBackend(true); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [backendUrl, isWeb]);

  // Re-read seerr config periodically (after user edits in Services page)
  useEffect(() => {
    const id = setInterval(() => {
      setSeerr(readSeerrConfig(storage));
    }, 2000);
    return () => clearInterval(id);
  }, [storage]);

  const value: AppMode = {
    platform,
    isStandalone: !isWeb || !backendUrl ? !hasBackend : false,
    hasBackend,
    seerr,
  };

  return createElement(AppModeContext.Provider, { value }, children);
}
