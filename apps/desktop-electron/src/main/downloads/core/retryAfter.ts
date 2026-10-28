/**
 * Le `Retry-After` d'un serveur qui PRÉPARE : la file du hors ligne en masse d'une extension (Sillon, lot « sq »
 * du 28/10) prépare un titre à la fois, à son rythme, et répond 503 + `Retry-After` (son estimation, en
 * secondes) tant que le titre n'est pas prêt. Le moteur relance À L'HEURE DITE, sans compter d'échec
 * (`networkRetry.ts`) — l'échelle 5 s → 5 min ne ferait que redemander à un serveur qui a déjà répondu.
 *
 * Secondes ou date HTTP (RFC 9110 § 10.2.3) ; bornée : au moins une seconde, au plus six heures (une
 * estimation démesurée ne fige pas la file : le titre sera redemandé, et la réponse dira la suite).
 */

const MIN_MS = 1_000;
const MAX_MS = 6 * 60 * 60_000;
const SERVICE_UNAVAILABLE = 503;

export function serverWaitMs(status: number, header: (name: string) => string | null, nowMs: number): number | undefined {
  if (status !== SERVICE_UNAVAILABLE) return undefined;
  const raw = header("retry-after")?.trim();
  if (!raw) return undefined;
  let ms: number;
  if (/^\d+$/.test(raw)) ms = Number(raw) * 1_000;
  else {
    const at = Date.parse(raw);
    if (Number.isNaN(at)) return undefined;
    ms = at - nowMs;
  }
  return Math.min(Math.max(ms, MIN_MS), MAX_MS);
}
