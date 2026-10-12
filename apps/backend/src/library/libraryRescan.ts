import { jellyfinAdminFetch, type JellyfinFailure } from "../services/jellyfinAdminFetch";
import {
  ITEM_REFRESH_QUERY,
  JELLYFIN_ITEM_ID_PATTERN,
  type LibraryRescanError,
  type LibraryRescanScope,
} from "./libraryRescanContract";

/**
 * « Réanalyser maintenant » : la vraie analyse, demandée à Jellyfin avec la
 * clé d'administration du serveur (contrat : `libraryRescanContract.ts`).
 *
 * Jellyfin met le travail en file et répond aussitôt (204) : on rend
 * « lancée », jamais « finie ». Un appel à la fois — un double clic ne double
 * pas l'analyse d'une bibliothèque entière.
 */

export type RescanOutcome =
  | { ok: true; scope: LibraryRescanScope }
  | { ok: false; error: LibraryRescanError };

interface RescanLogger {
  info(message: string): void;
  warn(message: string): void;
}

const ERROR_OF: Record<JellyfinFailure, LibraryRescanError> = {
  "not-configured": "not-configured",
  unreachable: "unreachable",
  rejected: "rejected",
  invalid: "failed",
};

let busy = false;

/** Le préfixe d'un identifiant, assez pour suivre un journal, rien de plus. */
const shortId = (id: string): string => id.replace(/-/g, "").slice(0, 8);

export async function startLibraryRescan(itemId: string | undefined, log: RescanLogger): Promise<RescanOutcome> {
  if (itemId !== undefined && !JELLYFIN_ITEM_ID_PATTERN.test(itemId)) return { ok: false, error: "bad-request" };
  if (busy) return { ok: false, error: "busy" };
  busy = true;
  const scope: LibraryRescanScope = itemId ? "item" : "libraries";
  const label = itemId ? `titre ${shortId(itemId)}` : "toutes les bibliothèques";
  try {
    const path = itemId
      ? `/Items/${encodeURIComponent(itemId)}/Refresh?${ITEM_REFRESH_QUERY}`
      : "/Library/Refresh";
    const res = await jellyfinAdminFetch(path, { method: "POST", expectEmpty: true, timeoutMs: 10_000 });
    if (res.ok) {
      log.info(`[library] analyse lancée : ${label}`);
      return { ok: true, scope };
    }
    // Un titre que Jellyfin ne connaît plus (supprimé entre-temps) : 404.
    const error: LibraryRescanError = res.status === 404 ? "not-found" : ERROR_OF[res.failure];
    log.warn(`[library] analyse refusée (${label}) : ${error}${res.status ? ` — HTTP ${res.status}` : ""}`);
    return { ok: false, error };
  } finally {
    busy = false;
  }
}
