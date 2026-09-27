/**
 * Les dernières erreurs d'écran, gardées pour être lues APRÈS coup.
 *
 * Sur une dalle, la console n'existe que dans l'inspecteur distant, qu'il faut
 * avoir ouvert AVANT l'incident. Or un écran qui tombe arrive « parfois », à
 * trois mètres, sans personne pour brancher `ares-inspect` au bon moment : le
 * premier correctif de l'écran noir a été écrit sur une hypothèse faute de la
 * moindre trace. On garde donc les dix dernières dans le stockage local — elles
 * survivent au redémarrage de l'application et se relisent par
 * `JSON.parse(localStorage.tentacle_tv_error_log)` depuis l'inspecteur.
 */

/** Clé traversée par une chaîne — ne jamais renommer (cf. CLAUDE.md). */
const LOG_KEY = "tentacle_tv_error_log";
const LIMIT = 10;

export interface ScreenErrorEntry {
  at: string;
  path: string;
  name: string;
  message: string;
  stack: string;
  component: string;
}

export function readScreenErrors(): ScreenErrorEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ScreenErrorEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordScreenError(error: Error, componentStack?: string | null): void {
  // `console.error` survit au build : seuls log, debug et info y sont retirés.
  console.error("[écran] rendu interrompu :", error, componentStack ?? "");
  try {
    const entries = readScreenErrors();
    entries.push({
      at: new Date().toISOString(),
      path: window.location.pathname,
      name: error.name,
      message: error.message.slice(0, 300),
      stack: (error.stack ?? "").slice(0, 600),
      component: (componentStack ?? "").slice(0, 400),
    });
    localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(-LIMIT)));
  } catch {
    // Stockage plein ou refusé : la console a déjà reçu l'erreur.
  }
}
