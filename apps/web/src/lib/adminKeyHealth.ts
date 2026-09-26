/**
 * La santé de la clé admin Jellyfin, telle que la rend
 * `GET /api/admin/jellyfin-key` — lue par le bandeau d'alerte et par la page
 * « Services », qui partagent la même entrée de cache et donc CE lecteur.
 *
 * ⚠️ Les noms de champs (`etat`, `verifieA`) et les valeurs (`revoquee`,
 * `sansDroits`…) SONT le corps de la réponse : ils restent en français
 * (`apps/backend/src/services/jellyfinKeyHealth.ts`). Le passage du code à
 * l'anglais, le 29 août 2026, les avait traduits de ce côté seulement : le
 * bandeau lisait `state`, que le serveur n'envoie pas, et ne s'affichait plus
 * jamais — une clé révoquée redevenait une panne muette. Le test voisin relit
 * la déclaration du serveur.
 */

export type AdminKeyState = "ok" | "revoquee" | "sansDroits" | "absente" | "injoignable";

export interface AdminKeyHealth {
  /** `null` : réponse illisible — on ne crie pas au loup. */
  state: AdminKeyState | null;
  checkedAt: string;
}

export const ADMIN_KEY_HEALTH_KEY = ["admin", "jellyfin-key"] as const;

const STATES: readonly AdminKeyState[] = ["ok", "revoquee", "sansDroits", "absente", "injoignable"];

export function readAdminKeyHealth(raw: unknown): AdminKeyHealth {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const state = STATES.find((known) => known === body.etat) ?? null;
  return { state, checkedAt: typeof body.verifieA === "string" ? body.verifieA : "" };
}
