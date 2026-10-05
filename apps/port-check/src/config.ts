/**
 * La configuration du service, lue dans l'environnement — tout a une valeur
 * par défaut sûre. Rien n'y est secret.
 *
 *   PORT                      8080
 *   HOST                      ::  (IPv4 et IPv6)
 *   TRUSTED_PROXIES           (vide) — adresses ou blocs CIDR dont X-Forwarded-For est cru
 *   CHECKS_PER_WINDOW         6   — tests par adresse (par /64 en IPv6) et par fenêtre
 *   WINDOW_MS                 600000 (dix minutes)
 *   PROBE_TIMEOUT_MS          5000 — par cible
 *   MAX_IN_FLIGHT             32  — tests menés en même temps, au plus
 *   ALLOW_NON_PUBLIC_SOURCES  false — vrai seulement pour un banc local
 */
export interface Config {
  port: number;
  host: string;
  trustedProxies: string[];
  checksPerWindow: number;
  windowMs: number;
  probeTimeoutMs: number;
  maxInFlight: number;
  allowNonPublicSources: boolean;
}

function int(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: int(env.PORT, 8080, 1, 65535),
    host: env.HOST?.trim() || "::",
    trustedProxies: (env.TRUSTED_PROXIES ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    checksPerWindow: int(env.CHECKS_PER_WINDOW, 6, 1, 1000),
    windowMs: int(env.WINDOW_MS, 600_000, 1_000, 86_400_000),
    probeTimeoutMs: int(env.PROBE_TIMEOUT_MS, 5_000, 100, 15_000),
    maxInFlight: int(env.MAX_IN_FLIGHT, 32, 1, 1024),
    allowNonPublicSources: env.ALLOW_NON_PUBLIC_SOURCES === "true",
  };
}
