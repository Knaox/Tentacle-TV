/** Log de diagnostic sync (grep `[WT]`) — actif automatiquement en dev
 *  (le script `pnpm dev` injecte WT_DEBUG=1), silencieux en production
 *  (l'image Docker ne définit jamais WT_DEBUG ; réactivable ponctuellement
 *  par un opérateur via cette variable d'environnement). */
const WT_DEBUG = process.env.WT_DEBUG === "1";

export function wtSrvLog(message: string, data?: Record<string, unknown>): void {
  if (!WT_DEBUG) return;
  console.log(`[WT] ${message}`, data ? JSON.stringify(data) : "");
}
