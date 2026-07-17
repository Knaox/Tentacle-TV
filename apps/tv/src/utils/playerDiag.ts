/**
 * Traces de diagnostic du lecteur TV (dev uniquement) : chaque événement clé du
 * pipeline — décision de flux, erreurs AVPlayer, stalls, watchdogs, reprises —
 * loggue UNE ligne horodatée vers Metro. Pendant une session de test sur device
 * physique, le terminal Metro devient le collecteur de diagnostic des lectures
 * longues (complété par les logs NATIFS [TVLR] pompés via useTVRemuxLogPump).
 */
const t0 = Date.now();

export function plog(tag: string, msg: string): void {
  if (!__DEV__) return;
  const t = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[TVDIAG +${t}s] [${tag}] ${msg}`);
}
