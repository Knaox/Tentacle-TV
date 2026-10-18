import { useEffect, useMemo, useState } from "react";
import { previewZoneHintLeft, previewZoneHintShown } from "@tentacle-tv/tv-core";
import type { ZoneHintState } from "./ZoneWatchText";

/**
 * L'indice de la télécommande de la zone, et QUAND il se lit (tv-core
 * `previewZoneHintShown`) : daté au départ de l'aperçu et à chaque geste qui
 * change ce qu'il dit (pause, reprise, son coupé ou remis) ; un seul minuteur,
 * pour l'effacer — aucun battement.
 */
export function useZoneHint(remote: { paused: boolean; muted: boolean } | null): ZoneHintState | null {
  const key = remote ? `${remote.paused ? 1 : 0}${remote.muted ? 1 : 0}` : null;
  // Le départ de la lecture de l'indice : nouveau à chaque état qu'il dit.
  const [since, setSince] = useState<{ key: string | null; at: number | null }>({ key: null, at: null });
  if (since.key !== key) setSince({ key, at: key === null ? null : Date.now() });
  const [, expire] = useState(0);
  useEffect(() => {
    const left = previewZoneHintLeft(since.at, Date.now());
    if (left <= 0) return undefined;
    const timer = setTimeout(() => expire((n) => n + 1), left);
    return () => clearTimeout(timer);
  }, [since]);
  const paused = remote?.paused ?? false;
  const muted = remote?.muted ?? false;
  const present = remote !== null;
  const shown = present && previewZoneHintShown({ paused, since: since.at, now: Date.now() });
  return useMemo(() => (present ? { paused, muted, shown } : null), [present, paused, muted, shown]);
}
