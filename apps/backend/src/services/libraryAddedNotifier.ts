import { getItemCount, getRecentlyAddedItems, getItemsByIds, type LibItem } from "./jellyfin";
import { getPrisma, hasPrisma } from "./db";
import { sendToUsers } from "./pushService";

// Notifie en push les utilisateurs opted-in des nouveaux ajouts en bibliothèque.
// Détection ROBUSTE (indépendante de l'event WS ET du DateCreated) :
//   - COUNT total (/Items/Counts) → détecteur fiable (monte à chaque ajout) ;
// Titrage :
//   - IDs de l'event WS ItemsAdded (items exacts, fiables même si date fausse) ;
//   - sinon items datés récents (getRecentlyAddedItems) ;
//   - sinon notif générique.
// Le WS accélère (poll immédiat) et alimente les IDs. Push direct, pas de in-app.

const POLL_INTERVAL = 60_000;
const WS_DEBOUNCE_MS = 8_000;
const FETCH_LIMIT = 40;
const COUNT_KEY = "lib_notif_count";
const DATE_KEY = "lib_notif_watermark";
const NAMED_TYPES = ["Movie", "Series", "Season", "Episode"];

let pollTimer: ReturnType<typeof setInterval> | null = null;
let wsTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
const addedBuffer = new Set<string>(); // IDs venus des events WS ItemsAdded

export function startLibraryAddedNotifier(): void {
  if (pollTimer) return;
  console.log("[LibNotif] Démarrage détection ajouts (poll 60s + WS, count + titres)");
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

async function poll(reason: string): Promise<void> {
  if (running || !hasPrisma()) return;
  running = true;
  try {
    const prisma = getPrisma();
    const wsIds = [...addedBuffer];
    addedBuffer.clear();
    const [total, items] = await Promise.all([getItemCount(), getRecentlyAddedItems(FETCH_LIMIT)]);
    const newest = items[0]?.DateCreated ?? null;

    const countRow = await prisma.serverConfig.findUnique({ where: { key: COUNT_KEY } });
    const dateRow = await prisma.serverConfig.findUnique({ where: { key: DATE_KEY } });
    const prevCount = countRow?.value != null ? Number(countRow.value) : null;
    const watermark = dateRow?.value ? new Date(dateRow.value).getTime() : null;

    console.log(
      `[LibNotif] poll(${reason}): count=${total ?? "∅"} (prev=${prevCount ?? "∅"}) | ` +
        `wsAdded=${wsIds.length} | top="${items[0]?.Name ?? "∅"}" created=${newest ?? "∅"}`,
    );

    // 1er run : baseline (mémorise count + date sans notifier l'existant).
    if (prevCount === null || watermark === null) {
      if (total !== null) await setKey(COUNT_KEY, String(total));
      if (newest) await setKey(DATE_KEY, newest);
      console.log(`[LibNotif] baseline (count=${total ?? "∅"})`);
      return;
    }

    const fresh = items.filter((i) => i.DateCreated && new Date(i.DateCreated).getTime() > watermark);
    const countDelta = total !== null ? total - prevCount : 0;

    // Rafraîchit toujours les repères (gère aussi les suppressions).
    if (total !== null) await setKey(COUNT_KEY, String(total));
    if (newest) await setKey(DATE_KEY, newest);

    if (fresh.length === 0 && countDelta <= 0 && wsIds.length === 0) return; // rien de neuf

    const prefs = await prisma.notificationPreference.findMany({
      where: { libraryAdded: true },
      select: { jellyfinUserId: true },
    });

    // Items pour titrer : IDs WS (fiables) en priorité, sinon les datés récents.
    let named: LibItem[] = wsIds.length > 0 ? await getItemsByIds(wsIds) : [];
    if (named.length === 0) named = fresh;
    named = named.filter((i) => NAMED_TYPES.includes(i.Type));

    console.log(
      `[LibNotif] nouveau : wsIds=${wsIds.length}, fresh=${fresh.length}, countDelta=${countDelta}, ` +
        `named=${named.length} → ${prefs.length} destinataire(s)`,
    );
    if (prefs.length === 0) return;

    const { title, body } = named.length > 0 ? composeItems(named) : composeGeneric(Math.max(countDelta, 1));
    const res = await sendToUsers(prefs.map((p) => p.jellyfinUserId), { title, body, data: { type: "library_added" } });
    console.log(`[LibNotif] push « ${title} » → ${JSON.stringify(res)}`);
  } catch (err) {
    console.error("[LibNotif] poll échoué:", err);
  } finally {
    running = false;
  }
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Libellé d'un item selon son type (film, série, saison, épisode). */
function describe(it: LibItem): string {
  if (it.Type === "Episode") {
    const series = it.SeriesName ?? it.Name;
    const code =
      it.ParentIndexNumber != null && it.IndexNumber != null
        ? ` S${pad2(it.ParentIndexNumber)}E${pad2(it.IndexNumber)}`
        : "";
    const ep = it.Name && it.Name !== series ? ` — ${it.Name}` : "";
    return `${series}${code}${ep}`;
  }
  if (it.Type === "Season") {
    const num = it.IndexNumber != null ? ` — Saison ${it.IndexNumber}` : it.Name ? ` — ${it.Name}` : "";
    return `${it.SeriesName ?? it.Name}${num}`;
  }
  return it.Name; // Movie, Series
}

/** Titre/corps avec les vrais titres des items ajoutés. */
function composeItems(items: LibItem[]): { title: string; body: string } {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const l = describe(it);
    if (l && !seen.has(l)) { seen.add(l); labels.push(l); }
  }
  if (labels.length === 1) {
    return { title: labels[0], body: "a été ajouté à votre bibliothèque" };
  }
  const preview = labels.slice(0, 3).join(" · ");
  const extra = labels.length > 3 ? ` +${labels.length - 3}` : "";
  return { title: `${labels.length} nouveautés ajoutées`, body: `${preview}${extra}` };
}

/** Repli générique : count monté mais aucun item identifiable (date fichier, WS muet). */
function composeGeneric(n: number): { title: string; body: string } {
  return {
    title: n === 1 ? "Nouveau contenu" : `${n} nouveautés ajoutées`,
    body: "Ajouté à votre bibliothèque",
  };
}
