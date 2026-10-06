import { useCallback, useEffect, useRef, useState } from "react";
import type { JellyfinProbeResult } from "@tentacle-tv/shared";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";

/** Une nouvelle sonde toutes les quelques secondes, tant que le Jellyfin de la pile démarre. */
const POLL_MS = 4000;
/** Ce qui veut dire « il démarre » (ou Tentacle le verrouille) : on attend, sans afficher d'erreur. */
export const STACK_WAITING: ReadonlySet<WizardErrorCode> = new Set(["jf_unreachable", "jf_timeout", "jf_claim_pending", "jf_not_jellyfin", "network"]);

export interface StackProbe {
  probe: JellyfinProbeResult | null;
  error: WizardErrorCode | null;
  /** Il démarre : la liste garde sa place en tête. */
  waiting: boolean;
  retry: () => void;
}

/**
 * Le Jellyfin de la pile complète, joint par son adresse interne : sondé
 * jusqu'à ce qu'il réponde (premier démarrage, verrouillage par Tentacle).
 * `url` absente : pas de pile complète, rien à sonder.
 */
export function useStackProbe(url: string | null, initial: JellyfinProbeResult | null): StackProbe {
  const [probe, setProbe] = useState<JellyfinProbeResult | null>(initial?.inStack ? initial : null);
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const prepared = useRef(false);

  const check = useCallback(async () => {
    if (!url) return;
    setPending(true);
    try {
      setProbe(await setupApi.probe(url));
      setError(null);
    } catch (err) {
      const code = err instanceof SetupApiError ? err.code : "internal";
      setProbe(null);
      setError(code);
      // Pas encore verrouillé (il démarrait) : on relance sa préparation, une fois.
      if (code === "jf_claim_pending" && !prepared.current) {
        prepared.current = true;
        void setupApi.prepare().catch(() => undefined);
      }
    } finally {
      setPending(false);
    }
  }, [url]);

  const waiting = !!url && !probe && (error === null || STACK_WAITING.has(error));
  useEffect(() => {
    if (url && !probe && !pending && error === null) void check();
  }, [url, probe, pending, error, check]);
  useEffect(() => {
    if (!waiting || error === null) return;
    const timer = setTimeout(() => void check(), POLL_MS);
    return () => clearTimeout(timer);
  }, [waiting, error, check]);

  return { probe, error, waiting, retry: () => void check() };
}
