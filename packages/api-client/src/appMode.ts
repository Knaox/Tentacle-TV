import { createContext, useContext, useState, useEffect, createElement } from "react";

// ── Types ──

export interface AppMode {
  platform: "web" | "desktop" | "mobile" | "tv";
  isStandalone: boolean;
  hasBackend: boolean;
}

export interface AppModeProviderProps {
  platform: "web" | "desktop" | "mobile" | "tv";
  backendUrl: string;
  children: React.ReactNode;
}

// ── Context ──

const AppModeContext = createContext<AppMode | null>(null);

export function useAppMode(): AppMode {
  const ctx = useContext(AppModeContext);
  if (!ctx) {
    throw new Error("useAppMode must be used within AppModeProvider");
  }
  return ctx;
}

// ── Provider ──

export function AppModeProvider({ platform, backendUrl, children }: AppModeProviderProps) {
  const isWeb = platform === "web";
  const [hasBackend, setHasBackend] = useState(isWeb && !!backendUrl);

  // For non-web platforms, optionally probe backend health
  useEffect(() => {
    if (isWeb || !backendUrl) return;
    const ctrl = new AbortController();
    fetch(`${backendUrl}/api/health`, { signal: ctrl.signal })
      .then((r) => { if (r.ok) setHasBackend(true); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [backendUrl, isWeb]);

  const value: AppMode = {
    platform,
    isStandalone: !isWeb || !backendUrl ? !hasBackend : false,
    hasBackend,
  };

  return createElement(AppModeContext.Provider, { value }, children);
}
