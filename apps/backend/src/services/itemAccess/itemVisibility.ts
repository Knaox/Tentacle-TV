/**
 * Ce titre de la bibliothèque est-il visible à CE compte ? Jellyfin en décide.
 *
 * # Pourquoi un titre à la fois
 *
 * `/Items/{id}?userId=` est la seule question que Jellyfin tranche avec TOUTE
 * la politique du compte : note maximale, types non classés, étiquettes ET
 * bibliothèques permises (404 sinon). Une liste `/Items?ids=…&userId=` oublie
 * les bibliothèques (mesuré sur 10.11.11, docs/DROITS-UTILISATEURS.md § 7) :
 * elle ne sert jamais de verdict.
 *
 * # Fermé à l'échec
 *
 * Un 404 (ou un identifiant que Jellyfin refuse) vaut « invisible » et se
 * garde 30 s — la fraîcheur du contrat (§ 1). Jellyfin muet, clé refusée ou
 * absente : « invisible » aussi, mais sans mémoire — la question se repose à
 * l'appel suivant, et la lecture refusée l'aurait été de toute façon.
 */

import { jellyfinAdminFetch } from "../jellyfinAdminFetch";

const TTL_MS = 30_000;
const MAX_ENTRIES = 5_000;

const verdicts = new Map<string, { visible: boolean; at: number }>();
const pending = new Map<string, Promise<boolean>>();

/** Sans tirets, en minuscules : Jellyfin rend les identifiants sous les deux formes. */
function normalize(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

function keyOf(userId: string, itemId: string): string {
  return `${normalize(userId)}:${normalize(itemId)}`;
}

async function askJellyfin(userId: string, itemId: string): Promise<{ visible: boolean; definitive: boolean }> {
  const result = await jellyfinAdminFetch(
    `/Items/${encodeURIComponent(itemId)}?userId=${encodeURIComponent(userId)}&Fields=&EnableImages=false&EnableUserData=false`,
  );
  // Seul le statut compte : une fiche servie (même illisible) dit « visible ».
  if (result.ok || (result.status !== undefined && result.status < 300)) return { visible: true, definitive: true };
  // 404 : invisible pour ce compte (ou inconnu) ; 400 : identifiant que Jellyfin refuse.
  const definitive = result.failure === "invalid" && (result.status === 404 || result.status === 400);
  return { visible: false, definitive };
}

function remember(key: string, visible: boolean): void {
  if (verdicts.size >= MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of verdicts) if (now - v.at > TTL_MS) verdicts.delete(k);
    // Encore plein : on repart de zéro plutôt que de grossir sans fin.
    if (verdicts.size >= MAX_ENTRIES) verdicts.clear();
  }
  verdicts.set(key, { visible, at: Date.now() });
}

export async function isItemVisibleTo(userId: string, itemId: string): Promise<boolean> {
  if (!userId || !itemId) return false;
  const key = keyOf(userId, itemId);
  const known = verdicts.get(key);
  if (known && Date.now() - known.at < TTL_MS) return known.visible;
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const run = askJellyfin(userId, itemId)
    .then(({ visible, definitive }) => {
      if (definitive) remember(key, visible);
      return visible;
    })
    .catch(() => false)
    .finally(() => pending.delete(key));
  pending.set(key, run);
  return run;
}

/** Les titres de la liste que ce compte voit, dans leur ordre. Un appel par
 *  titre (mémorisé) : réservé aux listes COURTES — une notification, un salon,
 *  une rangée. Pour un catalogue entier : `services/search/userAccess.ts`. */
export async function visibleItemIdsFor(userId: string, itemIds: readonly string[]): Promise<string[]> {
  const verdict = await Promise.all(itemIds.map((id) => isItemVisibleTo(userId, id)));
  return itemIds.filter((_id, index) => verdict[index]);
}

/** Une politique vient de changer (écrite par Tentacle) : ses verdicts tombent. */
export function invalidateItemVisibility(userId?: string): void {
  if (!userId) {
    verdicts.clear();
    return;
  }
  const prefix = `${normalize(userId)}:`;
  for (const key of verdicts.keys()) if (key.startsWith(prefix)) verdicts.delete(key);
}
