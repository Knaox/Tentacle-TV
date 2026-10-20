import {
  LIBRARY_VISIBILITY_MAX_ITEMS,
  LIBRARY_VISIBILITY_PATH,
  parseLibraryVisibility,
  type LibraryVisibilityDto,
} from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";

/**
 * Les titres gardés sur l'appareil, jugés par le serveur pour l'identité EN
 * SESSION (capacité `offline.verdicts`) — par lots de
 * `LIBRARY_VISIBILITY_MAX_ITEMS`. Une erreur remonte : l'appelant garde alors
 * le verdict qu'il avait (hors ligne, le dernier verdict connu fait foi).
 */
export async function fetchLibraryVisibility(
  itemIds: readonly string[],
  fetcher: (path: string, init: RequestInit) => Promise<unknown> = (path, init) => tentacleApiFetch<unknown>(path, init),
): Promise<LibraryVisibilityDto> {
  const out: LibraryVisibilityDto = { visible: [], hidden: [], gone: [] };
  const unique = [...new Set(itemIds)];
  for (let i = 0; i < unique.length; i += LIBRARY_VISIBILITY_MAX_ITEMS) {
    const chunk = unique.slice(i, i + LIBRARY_VISIBILITY_MAX_ITEMS);
    const verdict = parseLibraryVisibility(
      await fetcher(LIBRARY_VISIBILITY_PATH, { method: "POST", body: JSON.stringify({ itemIds: chunk }) }),
    );
    out.visible.push(...verdict.visible);
    out.hidden.push(...verdict.hidden);
    out.gone.push(...verdict.gone);
  }
  return out;
}
