import { getItemCount, getAllLibraryItemIds, getItemsByIds, type LibItem } from "./jellyfin";
import { getPrisma, hasPrisma } from "./db";
import { sendToUsers } from "./pushService";
import { composeItems, composeGeneric } from "./libraryAddedFormat";

// Notifie en push les utilisateurs opted-in des nouveaux ajouts en bibliothèque.
// Détection + NOMMAGE fiables par DIFF d'IDs (robuste vs date fichier ET WS muet) :
//   - garde-fou léger : COUNT total (/Items/Counts) → déclenche seulement si ça bouge ;
//   - sur changement : liste paginée des IDs (champs minimaux) diffée contre un
//     instantané en mémoire → IDs réellement nouveaux ;
//   - nommage : getItemsByIds sur ces seuls nouveaux IDs (par lots).
// Le WS (poke) accélère le poll mais n'est plus requis pour nommer. Push direct.

const POLL_INTERVAL = 60_000;
const WS_DEBOUNCE_MS = 8_000;
const COUNT_KEY = "lib_notif_count";
const NAMED_TYPES = ["Movie", "Series", "Season", "Episode"];
const NAME_CHUNK = 100; // IDs par appel getItemsByIds (longueur d'URL)

let pollTimer: ReturnType<typeof setInterval> | null = null;
let wsTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
const addedBuffer = new Set<string>(); // IDs venus des events WS ItemsAdded
let knownIds: Set<string> | null = null; // instantané des IDs biblio (baseline au boot)

export function startLibraryAddedNotifier(): void {
  if (pollTimer) return;
  console.log("[LibNotif] Démarrage détection ajouts (poll 60s + WS, diff d'IDs)");
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

async function setKey(key: string, value: string): Promise<void> {
  await getPrisma().serverConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** Envoie une notif d'ajout aux utilisateurs opted-in (libraryAdded). */
async function notify(payload: { title: string; body: string }): Promise<void> {
  const prefs = await getPrisma().notificationPreference.findMany({
    where: { libraryAdded: true },
    select: { jellyfinUserId: true },
  });
  if (prefs.length === 0) return;
  const res = await sendToUsers(prefs.map((p) => p.jellyfinUserId), {
    title: payload.title, body: payload.body, data: { type: "library_added" },
  });
  console.log(`[LibNotif] push « ${payload.title} » → ${JSON.stringify(res)}`);
}

/** Métadonnées de titrage pour des IDs, par lots (longueur d'URL). */
async function namesForIds(ids: string[]): Promise<LibItem[]> {
  const out: LibItem[] = [];
  for (let i = 0; i < ids.length; i += NAME_CHUNK) {
    out.push(...(await getItemsByIds(ids.slice(i, i + NAME_CHUNK))));
  }
  return out;
}

async function poll(reason: string): Promise<void> {
  if (running || !hasPrisma()) return;
  running = true;
  try {
    const prisma = getPrisma();
    const wsIds = [...addedBuffer];
    addedBuffer.clear();

    const total = await getItemCount();
    const countRow = await prisma.serverConfig.findUnique({ where: { key: COUNT_KEY } });
    const prevCount = countRow?.value != null ? Number(countRow.value) : null;

    console.log(`[LibNotif] poll(${reason}): count=${total ?? "∅"} (prev=${prevCount ?? "∅"}) | wsAdded=${wsIds.length}`);

    // 1er run OU instantané non chargé : baseline (mémorise count + IDs, sans notifier l'existant).
    if (prevCount === null || knownIds === null) {
      const ids = await getAllLibraryItemIds();
      if (ids.length > 0) knownIds = new Set(ids);
      if (total !== null) await setKey(COUNT_KEY, String(total));
      console.log(`[LibNotif] baseline (count=${total ?? "∅"}, ids=${ids.length})`);
      return;
    }

    // Garde-fou : rien n'a bougé (count stable + pas de signal WS) → pas de fetch paginé.
    if (total !== null && total === prevCount && wsIds.length === 0) return;

    // Récupère tous les IDs (paginé, champs minimaux) et diffe contre l'instantané.
    const currentIds = await getAllLibraryItemIds();
    if (currentIds.length === 0) {
      // Échec du fetch : repli générique si le count a monté (ne PAS toucher knownIds).
      const delta = total !== null ? total - prevCount : 0;
      if (delta > 0) await notify(composeGeneric(delta));
      if (total !== null) await setKey(COUNT_KEY, String(total));
      return;
    }

    const newIds = currentIds.filter((id) => !knownIds!.has(id));
    knownIds = new Set(currentIds);
    if (total !== null) await setKey(COUNT_KEY, String(total));

    console.log(`[LibNotif] diff(${reason}): ids=${currentIds.length}, nouveaux=${newIds.length}`);
    if (newIds.length === 0) return; // suppression / changement méta uniquement

    const named = (await namesForIds(newIds)).filter((i) => NAMED_TYPES.includes(i.Type));
    await notify(named.length > 0 ? composeItems(named) : composeGeneric(newIds.length));
  } catch (err) {
    console.error("[LibNotif] poll échoué:", err);
  } finally {
    running = false;
  }
}
