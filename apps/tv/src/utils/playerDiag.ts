/**
 * Traces de diagnostic du lecteur TV (dev uniquement) : chaque événement clé du
 * pipeline — décision de flux, ouverture PrismCore, erreurs AVPlayer, reprises —
 * loggue UNE ligne horodatée vers Metro. Pendant une session de test sur device
 * physique, le terminal Metro devient le collecteur de diagnostic des lectures
 * longues (les journaux natifs de PrismCore, eux, vont dans os.log
 * `cz.zmrhal.prismcore`).
 */
const t0 = Date.now();

export function plog(tag: string, msg: string): void {
  if (!__DEV__) return;
  const t = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[TVDIAG +${t}s] [${tag}] ${msg}`);
}
