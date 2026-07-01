import { useState, useEffect } from "react";
import { getBackendBase } from "../lib/backendBase";

/**
 * Version minimale du serveur Tentacle TV requise par CE client. À incrémenter
 * quand le client se met à dépendre d'une nouveauté serveur. Si le serveur
 * renvoie une version plus ancienne, une bannière d'avertissement s'affiche à
 * l'admin (le client pourrait dysfonctionner).
 */
export const MIN_SERVER_VERSION = "1.2.0";

/** Compare deux versions semver simplifiées "x.y.z" → -1 | 0 | 1. */
function cmpVersion(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** Lit la version du serveur (/api/config) et indique si elle est trop ancienne. */
export function useServerCompat() {
  const [serverVersion, setServerVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getBackendBase()}/api/config`);
        const cfg = res.ok ? await res.json() : null;
        if (!cancelled && cfg?.version) setServerVersion(String(cfg.version));
      } catch {
        /* réseau indisponible — on n'affiche rien */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const incompatible = serverVersion != null && cmpVersion(serverVersion, MIN_SERVER_VERSION) < 0;
  return { serverVersion, incompatible };
}
