import { getItemCount, getAllLibraryItemIds, getItemsByIds, type LibItem } from "./jellyfin";
import { getPrisma, hasPrisma } from "./db";
import { sendToUser, sendToUsers } from "./pushService";
import { composeItems, composeGeneric } from "./libraryAddedFormat";
import { indexClaims, isClaimed } from "./libraryAddedDedup";

// Notifie en push les ajouts bibliothèque. Détection + nommage par DIFF d'IDs
// (robuste vs date fichier ET WS muet). Instantané PERSISTANT (table
// library_known_id → rattrape les ajouts faits pendant une coupure serveur).
// Anti-doublon : les contenus revendiqués par un plugin (content_claims, ex.
// Seer) ne sont pas re-notifiés côté biblio à l'utilisateur concerné.

const POLL_INTERVAL = 60_000;
const WS_DEBOUNCE_MS = 8_000;
const NAMED_TYPES = ["Movie", "Series", "Season", "Episode"];
const NAME_CHUNK = 100; // IDs par appel getItemsByIds (longueur d'URL)
const DB_CHUNK = 1000; // lignes par batch d'écriture library_known_id

let pollTimer: ReturnType<typeof setInterval> | null = null;
let wsTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
const addedBuffer = new Set<string>(); // IDs venus des events WS ItemsAdded
let knownIds: Set<string> | null = null; // chargé depuis library_known_id au 1er poll

export function startLibraryAddedNotifier(): void {
  if (pollTimer) return;
  console.log("[LibNotif] Démarrage détection ajouts (poll 60s + WS, diff d'IDs persistant)");
  pollTimer = setInterval(() => void poll("interval"), POLL_INTERVAL);
  setTimeout(() => void poll("boot"), 8_000);
}

export function stopLibraryAddedNotifier(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (wsTimer) { clearTimeout(wsTimer); wsTimer = null; }
}

/** WS LibraryChanged : bufferise les ItemsAdded + programme un poll immédiat (débouncé). */
export function poke(itemIds: unknown): void {
  if (Array.isArray(itemIds)) {
    for (const id of itemIds) if (typeof id === "string" && id) addedBuffer.add(id);
  }
  if (wsTimer) clearTimeout(wsTimer);
  wsTimer = setTimeout(() => void poll("ws"), WS_DEBOUNCE_MS);
}

/** Persiste le delta d'IDs (INSERT nouveaux, DELETE retirés) — léger, incrémental. */
async function persistDelta(add: string[], remove: string[]): Promise<void> {
  const prisma = getPrisma();
  for (let i = 0; i < remove.length; i += DB_CHUNK) {
    await prisma.libraryKnownId.deleteMany({ where: { itemId: { in: remove.slice(i, i + DB_CHUNK) } } });
  }
  for (let i = 0; i < add.length; i += DB_CHUNK) {
    await prisma.libraryKnownId.createMany({
      data: add.slice(i, i + DB_CHUNK).map((itemId) => ({ itemId })),
      skipDuplicates: true,
    });
  }
}

/** Métadonnées de titrage pour des IDs, par lots (longueur d'URL). */
async function namesForIds(ids: string[]): Promise<LibItem[]> {
  const out: LibItem[] = [];
  for (let i = 0; i < ids.length; i += NAME_CHUNK) {
    out.push(...(await getItemsByIds(ids.slice(i, i + NAME_CHUNK))));
  }
  return out;
}

/** Repli générique (aucun item nommé) : envoi à tous les opted-in. */
async function notifyGeneric(payload: { title: string; body: string }): Promise<void> {
  const prefs = await getPrisma().notificationPreference.findMany({
    where: { libraryAdded: true }, select: { jellyfinUserId: true },
  });
  if (prefs.length === 0) return;
  await sendToUsers(prefs.map((p) => p.jellyfinUserId), {
    title: payload.title, body: payload.body, data: { type: "library_added" },
  });
  console.log(`[LibNotif] push « ${payload.title} » → tous`);
}

/** Envoi PAR UTILISATEUR avec filtrage anti-doublon (claims plugins). */
async function notifyNamed(named: LibItem[]): Promise<void> {
  const prisma = getPrisma();
  const prefs = await prisma.notificationPreference.findMany({
    where: { libraryAdded: true }, select: { jellyfinUserId: true },
  });
  if (prefs.length === 0) return;

  const claims = await prisma.contentClaim.findMany({
    where: { expiresAt: { gt: new Date() } },
    select: { tmdbId: true, jellyfinUserId: true, title: true },
  });
  const claimIndex = indexClaims(claims);

  for (const p of prefs) {
    const userClaims = claimIndex.get(p.jellyfinUserId);
    const items = userClaims ? named.filter((it) => !isClaimed(it, userClaims)) : named;
    if (items.length === 0) continue;
    const { title, body } = composeItems(items);
    await sendToUser(p.jellyfinUserId, { title, body, data: { type: "library_added" } });
    console.log(`[LibNotif] push[${p.jellyfinUserId.slice(0, 8)}] « ${title} »`);
  }
}

async function poll(reason: string): Promise<void> {
  if (running || !hasPrisma()) return;
  running = true;
  try {
    const prisma = getPrisma();
    const wsIds = [...addedBuffer];
    addedBuffer.clear();

    // Charge l'instantané persistant au 1er passage (survit aux redémarrages).
    if (knownIds === null) {
      const rows = await prisma.libraryKnownId.findMany({ select: { itemId: true } });
      knownIds = new Set(rows.map((r) => r.itemId));
      console.log(`[LibNotif] instantané chargé: ${knownIds.size} ids`);
    }

    const total = await getItemCount();

    // Table vide = jamais initialisé → baseline (peupler sans notifier l'existant).
    if (knownIds.size === 0) {
      const ids = await getAllLibraryItemIds();
      if (ids.length > 0) { await persistDelta(ids, []); knownIds = new Set(ids); }
      console.log(`[LibNotif] baseline (count=${total ?? "∅"}, ids=${ids.length})`);
      return;
    }

    // Garde-fou : count stable + pas de signal WS → pas de fetch paginé.
    if (total !== null && total === knownIds.size && wsIds.length === 0) return;

    const currentIds = await getAllLibraryItemIds();
    if (currentIds.length === 0) return; // échec fetch → ne rien toucher, réessai au prochain poll

    const currentSet = new Set(currentIds);
    const newIds = currentIds.filter((id) => !knownIds!.has(id));
    const removedIds = [...knownIds].filter((id) => !currentSet.has(id));

    await persistDelta(newIds, removedIds);
    knownIds = currentSet;

    console.log(`[LibNotif] diff(${reason}): ids=${currentIds.length}, nouveaux=${newIds.length}, retirés=${removedIds.length}`);
    if (newIds.length === 0) return; // suppression / changement méta uniquement

    const named = (await namesForIds(newIds)).filter((i) => NAMED_TYPES.includes(i.Type));
    if (named.length > 0) await notifyNamed(named);
    else await notifyGeneric(composeGeneric(newIds.length));
  } catch (err) {
    console.error("[LibNotif] poll échoué:", err);
  } finally {
    running = false;
  }
}
