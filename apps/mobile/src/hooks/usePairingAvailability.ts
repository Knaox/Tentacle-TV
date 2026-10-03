import { useCallback, useEffect, useState } from "react";
import type { StorageAdapter } from "@tentacle-tv/api-client";

/**
 * Le jumelage d'une TV n'est possible que si l'URL publique du serveur est
 * définie (`/api/config` → `publicUrl`). `available` : `null` pendant la
 * vérification. Une PANNE (serveur muet, réseau) n'est pas « jumelage
 * indisponible » : elle remonte dans `error`, avec de quoi réessayer.
 */
export function usePairingAvailability(storage: Pick<StorageAdapter, "getItem">): {
  available: boolean | null;
  error: unknown;
  retry: () => void;
} {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setAvailable(null);
    setError(null);
    (async () => {
      try {
        const base = storage.getItem("tentacle_server_url") ?? "";
        const res = base ? await fetch(`${base}/api/config`) : null;
        if (res && !res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        const cfg = res ? await res.json() : null;
        if (!cancelled) setAvailable(!!cfg?.publicUrl);
      } catch (err) {
        if (!cancelled) setError(err);
      }
    })();
    return () => { cancelled = true; };
  }, [storage, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { available, error, retry };
}

/**
 * Le refus d'un jumelage, en clé de l'espace `pairing` : un code inconnu,
 * expiré ou déjà employé (404, 409, ou ce que le relais en dit), sinon le
 * service de jumelage injoignable.
 */
export function pairingErrorKey(err: unknown): "codeInvalid" | "relayError" {
  const status = typeof err === "object" && err !== null ? (err as { status?: unknown }).status : undefined;
  const msg = err instanceof Error ? err.message : String(err);
  if (status === 404 || status === 409 || /\b(404|409)\b|invalide|expir|utilis|invalid|used/i.test(msg)) return "codeInvalid";
  return "relayError";
}
