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

function writeCache(config: AutoplayConfig): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(config));
  } catch {
    /* quota localStorage : le défaut fera l'affaire */
  }
}

/**
 * Photographie la config auto-play pour l'hors-ligne, HORS du lecteur.
 *
 * Le hook ci-dessous n'écrit son cache que sur une lecture en STREAMING : un
 * poste qui ne lit que des téléchargements n'aurait donc jamais la valeur du
 * serveur et resterait au repli — un `MaxResumePct` réglé à 85 ferait diverger
 * l'hors-ligne de l'en-ligne, alors que c'est précisément ce seuil qui décide
 * qu'un épisode est vu (localPlaybackProgress).
 *
 * Appelée à chaque passage en ligne, là où l'on photographie déjà le reste
 * (OfflineSessionSync). La lecture locale, elle, reste à zéro réseau.
 */
export async function refreshAutoplayConfigCache(backendBase: string): Promise<void> {
  try {
    const res = await fetch(`${backendBase}/api/config/autoplay`);
    if (!res.ok) return;
    writeCache((await res.json()) as AutoplayConfig);
  } catch {
    /* backend injoignable : on garde la photo précédente */
  }
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
    writeCache(data);
  }, [data]);
  const cached = useMemo(() => (isLocalPlayback ? readCache() : null), [isLocalPlayback]);
  if (isLocalPlayback) return cached ?? DEFAULTS;
  return data ?? DEFAULTS;
}
