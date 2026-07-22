import { useEffect, useMemo } from "react";
import { useAutoplayConfig, type AutoplayConfig } from "@tentacle-tv/api-client";

const CACHE_KEY = "tentacle_autoplay_config";
const DEFAULTS: AutoplayConfig = { enabled: true, maxResumePct: 90 };

function readCache(): AutoplayConfig {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AutoplayConfig>) };
  } catch {
    /* cache illisible : défauts */
  }
  return DEFAULTS;
}

/**
 * Config auto-play LOCALE D'ABORD : en lecture locale, aucun fetch ni poll —
 * dernier état connu du serveur (localStorage, écrit à chaque succès), défauts
 * sinon. En streaming, comportement historique : poll 30 s pendant la lecture
 * (seuil MaxResumePct à jour en ≤ ~60 s).
 */
export function useAutoplayConfigLocalFirst(
  active: boolean,
  isLocalPlayback: boolean,
): AutoplayConfig {
  const { data } = useAutoplayConfig(active && !isLocalPlayback, { enabled: !isLocalPlayback });
  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      /* quota localStorage : le défaut fera l'affaire */
    }
  }, [data]);
  const cached = useMemo(() => (isLocalPlayback ? readCache() : null), [isLocalPlayback]);
  if (isLocalPlayback) return cached ?? DEFAULTS;
  return data ?? DEFAULTS;
}
