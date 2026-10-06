import { jellyfinAdminFetch } from "./jellyfinAdminFetch";

/** Un id Jellyfin sous sa forme comparable : minuscules, sans tirets. */
const normalizeId = (id: string) => id.replace(/-/g, "").toLowerCase();

/**
 * Le titre fixe du héros (`heroFixedItemId`) est-il encore visible pour ce
 * compte ? `true` / `false` ; `null` : on ne sait pas (Jellyfin muet, clé
 * absente) — rien n'est alors décidé à sa place.
 *
 * Par `/Items?Ids=` avec la clé d'administration et le `userId` du compte :
 * un titre effacé, ou caché par les droits du compte, n'y figure pas.
 * Mesuré (10.11) : un `Ids` qui n'est pas un GUID est IGNORÉ et la réponse
 * liste d'autres titres — d'où la comparaison des ids, jamais un « la liste
 * n'est pas vide ».
 */
export async function isFixedHeroItemVisible(userId: string, itemId: string): Promise<boolean | null> {
  const query = new URLSearchParams({
    userId,
    Ids: itemId,
    Recursive: "true",
    EnableImages: "false",
    EnableUserData: "false",
    Fields: "",
  });
  const result = await jellyfinAdminFetch<{ Items?: Array<{ Id?: string }> }>(`/Items?${query}`, { timeoutMs: 2500 });
  if (!result.ok) return null;
  const wanted = normalizeId(itemId);
  return (result.data.Items ?? []).some((item) => typeof item.Id === "string" && normalizeId(item.Id) === wanted);
}
