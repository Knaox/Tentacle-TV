import { useEffect, useState } from "react";
import { getVersion, isDesktopApp } from "../desktop/bridge";

/**
 * La version desktop à afficher : la vraie version du bundle installé (ex. une
 * 1.0.0 de build App Store) dès que la coquille a répondu, la constante de
 * build (`versions.json`, injectée par la CI) en attendant ou hors desktop.
 */
export async function resolveDesktopVersion(): Promise<string> {
  if (!isDesktopApp()) return __APP_VERSION_DESKTOP__;
  try {
    const real = await getVersion();
    return real || __APP_VERSION_DESKTOP__;
  } catch {
    return __APP_VERSION_DESKTOP__;
  }
}

export function useDesktopVersion(): string {
  const [version, setVersion] = useState<string>(__APP_VERSION_DESKTOP__);
  useEffect(() => {
    let cancelled = false;
    void resolveDesktopVersion().then((v) => {
      if (!cancelled) setVersion(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return version;
}
