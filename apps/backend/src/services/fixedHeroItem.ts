import { jellyfinAdminFetch } from "./jellyfinAdminFetch";

/** Un id Jellyfin sous sa forme comparable : minuscules, sans tirets. */
const normalizeId = (id: string) => id.replace(/-/g, "").toLowerCase();

/**
 * Le titre fixe du héros (`heroFixedItemId`) est-il encore visible pour ce
 * compte ? `true` / `false` ; `null` : on ne sait pas (Jellyfin muet, clé
 * absente) — rien n'est alors décidé à sa place.
 *
 * Par `/Items/{id}?userId=` avec la clé d'administration : un titre effacé,
 * ou caché par les droits du compte — note, étiquettes ET bibliothèques —,
 * rend 404. Jamais `/Items?Ids=` : il oublie les bibliothèques permises
 * (mesuré 10.11.11, docs/DROITS-UTILISATEURS.md § 7).
 */
export async function isFixedHeroItemVisible(userId: string, itemId: string): Promise<boolean | null> {
  const query = new URLSearchParams({ userId, EnableImages: "false", EnableUserData: "false", Fields: "" });
  const result = await jellyfinAdminFetch<{ Id?: string }>(`/Items/${encodeURIComponent(itemId)}?${query}`, { timeoutMs: 2500 });
  if (result.ok) return typeof result.data?.Id === "string" && normalizeId(result.data.Id) === normalizeId(itemId);
  // 404 : effacé ou interdit ; 400 : un id que Jellyfin refuse.
  if (result.failure === "invalid" && (result.status === 404 || result.status === 400)) return false;
  return null;
}
