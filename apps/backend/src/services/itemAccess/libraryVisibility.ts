import { getContentPolicy, limitsLibraries } from "../contentPolicy";
import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { adminUserParam } from "../jellyfinLibrary";
import type { LibraryVisibilityDto } from "../../libraryVisibility/libraryVisibilityContract";
import { visibleItemIdsFor } from "./itemVisibility";

/**
 * Le verdict des titres gardés sur un appareil, pour l'identité EN SESSION
 * (compte, ou profil de la famille) — contrat :
 * `libraryVisibility/libraryVisibilityContract.ts`.
 *
 * `visible` : la question que Jellyfin tranche avec TOUTE la politique
 * (`isItemVisibleTo`, un titre à la fois, mémorisé 30 s). Pour le reste, il
 * faut savoir si le titre est encore dans la bibliothèque : une seule liste
 * au nom de l'administrateur (`Ids`), qui voit tout. Présent = caché à cette
 * identité. Absent = disparu — lisible depuis l'appareil pour une identité
 * sans restriction (comme avant), caché pour une identité restreinte, aux
 * bibliothèques bornées ou à la politique illisible : on ne peut plus juger,
 * fermé à l'échec (docs/DROITS-UTILISATEURS.md § 1). Jellyfin muet sur cette
 * liste : tout ce qui n'est pas visible est caché.
 */
export async function libraryVisibilityFor(userId: string, itemIds: readonly string[]): Promise<LibraryVisibilityDto> {
  if (itemIds.length === 0) return { visible: [], hidden: [], gone: [] };
  const visible = await visibleItemIdsFor(userId, itemIds);
  const seen = new Set(visible);
  const others = itemIds.filter((id) => !seen.has(id));
  if (others.length === 0) return { visible, hidden: [], gone: [] };

  const policy = await getContentPolicy(userId);
  const judged = policy.readable && !policy.restricted && !limitsLibraries(policy);
  if (!judged) return { visible, hidden: others, gone: [] };

  const listed = await jellyfinAdminFetch<{ Items?: Array<{ Id?: string }> }>(
    `/Items?Ids=${others.map(encodeURIComponent).join(",")}&Recursive=true&Fields=&EnableImages=false&EnableUserData=false${await adminUserParam()}`,
    { timeoutMs: 8_000 },
  );
  if (!listed.ok) return { visible, hidden: others, gone: [] };
  const norm = (id: string) => id.replace(/-/g, "").toLowerCase();
  const present = new Set((listed.data.Items ?? []).map((item) => norm(item.Id ?? "")));
  return {
    visible,
    hidden: others.filter((id) => present.has(norm(id))),
    gone: others.filter((id) => !present.has(norm(id))),
  };
}
