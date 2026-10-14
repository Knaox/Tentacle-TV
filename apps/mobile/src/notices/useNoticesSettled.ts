import { useEffect, useState } from "react";
import {
  useAdminKeyHealth,
  useAdminMetadataStatus,
  useDismissedHints,
  useServerCapabilities,
} from "@tentacle-tv/api-client";

/** Au-delà, un avertissement qui ne répond pas n'en retient pas d'autres. */
const SETTLE_CAP_MS = 10_000;

/**
 * Les avertissements du démarrage ont-ils TRANCHÉ ? Ils ne concernent que les
 * administrateurs et se décident sur les mêmes lectures que `useClientNotice`
 * (rappels masqués, métadonnées, clé d'administration, configuration) — les
 * mêmes requêtes, partagées par le cache : rien ne part en double. Une lecture
 * qui échoue a tranché ; une qui ne répond pas cesse de retenir au bout de
 * `SETTLE_CAP_MS`.
 */
export function useNoticesSettled(isAdmin: boolean): boolean {
  const hints = useDismissedHints({ enabled: isAdmin });
  const metadata = useAdminMetadataStatus({ enabled: isAdmin });
  const adminKey = useAdminKeyHealth({ enabled: isAdmin });
  const { settled: configSettled } = useServerCapabilities();
  const answered = !isAdmin || (configSettled && !hints.isPending && !metadata.isPending && !adminKey.isPending);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (answered) return;
    const timer = setTimeout(() => setTimedOut(true), SETTLE_CAP_MS);
    return () => clearTimeout(timer);
  }, [answered]);

  return answered || timedOut;
}
