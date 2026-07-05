/**
 * Logger de diagnostic Watch Together / lecture synchronisée.
 * Actif par défaut (phase de debug intensif), désactivable via
 * `localStorage.tentacle_wt_log = "0"` (ré-évalué au prochain chargement).
 *
 * Format : `[WT +123.4s scope] message { data }` — le timestamp relatif au
 * chargement de l'app permet de corréler les traces des deux players d'un
 * groupe (chacun colle ses logs au même événement réseau).
 *
 * Scopes utilisés : engine (moteur de sync), transport (surface player),
 * mpv (événements libmpv), mpv-src (chargement source desktop), web-video
 * (événements <video>), session (rebuild URL/PlaySessionId), page (pages
 * Watch*), provider (messages serveur reçus).
 */

const t0 = Date.now();
let enabled: boolean | null = null;

function isEnabled(): boolean {
  if (enabled === null) {
    try {
      enabled = typeof localStorage === "undefined" || localStorage.getItem("tentacle_wt_log") !== "0";
    } catch {
      enabled = true;
    }
  }
  return enabled;
}

export function wtLog(scope: string, message: string, data?: unknown): void {
  if (!isEnabled()) return;
  const ts = ((Date.now() - t0) / 1000).toFixed(1);
  if (data !== undefined) console.info(`[WT +${ts}s ${scope}] ${message}`, data);
  else console.info(`[WT +${ts}s ${scope}] ${message}`);
}
