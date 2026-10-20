/**
 * Le dernier mot du serveur sur le droit `keepOffline` de chaque compte de
 * l'appareil, retenu pour le hors ligne : sans serveur on ne peut pas reposer
 * la question, et le cache des requêtes ne survit ni à une bascule de session
 * ni à un redémarrage. Seul le mot dit à la session DU COMPTE compte (jamais
 * celui d'un profil : `offlineOwner.ts`).
 *
 * `{ [compte]: vrai | faux }`, identifiants sans tirets ni casse.
 *
 * ⚠️ La clé est traversée par une chaîne : jamais renommée.
 */

export const OFFLINE_KEEP_RIGHT_KEY = "tentacle_offline_keep_right";

const norm = (id: string) => id.replace(/-/g, "").toLowerCase();

function parse(raw: string | null | undefined): Record<string, boolean> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: Record<string, boolean> = {};
    for (const [id, right] of Object.entries(value as Record<string, unknown>)) {
      if (typeof right === "boolean") out[norm(id)] = right;
    }
    return out;
  } catch {
    return {};
  }
}

/** Le dernier mot retenu pour ce compte ; null s'il n'a jamais été dit. */
export function lastKeepRight(raw: string | null | undefined, accountId: string | null | undefined): boolean | null {
  if (!accountId) return null;
  return parse(raw)[norm(accountId)] ?? null;
}

/** La valeur à écrire après un nouveau mot ; null s'il ne change rien (pas d'écriture pour rien). */
export function rememberKeepRight(raw: string | null | undefined, accountId: string, right: boolean): string | null {
  const map = parse(raw);
  const key = norm(accountId);
  if (map[key] === right) return null;
  return JSON.stringify({ ...map, [key]: right });
}
