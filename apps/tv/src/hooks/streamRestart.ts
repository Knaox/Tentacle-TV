/**
 * La relance du flux — contrat commun aux deux variantes de `useTVStreamUrl`
 * (tvOS, Android TV), exposé par `usePlayerStreamPipeline` (`restartStream`).
 *
 * Relancer, c'est reconstruire la source À UNE POSITION, sous la MÊME forme —
 * PrismCore reste PrismCore, même palier de qualité, mêmes pistes —, en
 * rechargement DOUX : jamais l'écran de chargement, jamais l'état d'échec,
 * jamais le transcodage forcé. Trois appelants : le retour au premier plan
 * (bouclage PrismCore mort pendant la suspension), la reprise après une
 * coupure du serveur ou de Jellyfin, et la sortie audio revenue
 * (`useAudioErrorRetry`).
 *
 * - "ok" : la nouvelle URL est émise (la lecture repart de `at`) ;
 * - "failed" : la résolution a échoué — l'état courant reste tel quel ;
 * - "busy" : une relance est déjà en vol.
 */
export type RestartReason = "resume" | "network" | "audio" | "manual";
export type RestartOutcome = "ok" | "failed" | "busy";
export interface RestartOptions {
  /** Position de reprise, timeline absolue — défaut : la position courante. */
  at?: number;
  reason: RestartReason;
}

/**
 * Une URL DIFFÉRENTE qui désigne la même chose : sur une URL inchangée, le
 * lecteur natif ne recharge rien (lecture directe, où l'URL ne porte ni
 * session ni port). Jellyfin ignore le paramètre (vérifié : 206 sur
 * `/Videos/{id}/stream`). Il se pose AVANT le fragment `#tnt-start`, que le
 * natif Android lit jusqu'au bout de l'URL.
 */
export function withRestartMark(url: string, mark: number): string {
  if (mark <= 0) return url;
  const hash = url.indexOf("#");
  const base = hash >= 0 ? url.slice(0, hash) : url;
  const fragment = hash >= 0 ? url.slice(hash) : "";
  return `${base}${base.includes("?") ? "&" : "?"}tntRestart=${mark}${fragment}`;
}
