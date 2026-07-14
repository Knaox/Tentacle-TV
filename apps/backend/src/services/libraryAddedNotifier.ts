import { getItemCount, getRecentlyAddedItems } from "./jellyfin";
import { getPrisma, hasPrisma } from "./db";
import { sendToUsers } from "./pushService";

// Notifie en push les utilisateurs opted-in des nouveaux ajouts en bibliothèque.
// Détection ROBUSTE par POLL de l'API Jellyfin — indépendante de l'event WS ET du
// DateCreated (qui peut valoir la date du FICHIER, pas de l'ajout, si l'option
// Jellyfin UseFileCreationTimeForDateAdded est active). On combine :
//   - le COUNT total (/Items/Counts) → augmente à chaque ajout quelle que soit la
//     date → détecteur fiable ;
//   - le tri par DateCreated → fournit les TITRES quand la date est récente (Seer).
// Si le count monte sans item daté récent, on notifie de façon générique. Le WS
// ne fait qu'accélérer (poll immédiat). Push direct, pas de ligne in-app.

const POLL_INTERVAL = 60_000;
const WS_DEBOUNCE_MS = 8_000;
const FETCH_LIMIT = 40;
const COUNT_KEY = "lib_notif_count";
const DATE_KEY = "lib_notif_watermark";

let pollTimer: ReturnType<typeof setInterval> | null = null;
let wsTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

export function startLibraryAddedNotifier(): void {
  if (pollTimer) return;
  console.log("[LibNotif] Démarrage détection ajouts (poll 60s + WS, count + date)");
  pollTimer = setInterval(() => void poll("interval"), POLL_INTERVAL);
  setTimeout(() => void poll("boot"), 8_000);
}

export function stopLibraryAddedNotifier(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (wsTimer) { clearTimeout(wsTimer); wsTimer = null; }
}

/** Déclenché par jellyfinWs sur LibraryChanged : programme un poll immédiat (débouncé). */
export function poke(): void {
  if (wsTimer) clearTimeout(wsTimer);
  wsTimer = setTimeout(() => void poll("ws"), WS_DEBOUNCE_MS);
}

async function setKey(key: string, value: string): Promise<void> {
  await getPrisma().serverConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function poll(reason: string): Promise<void> {
  if (running || !hasPrisma()) return;
  running = true;
  try {
    const prisma = getPrisma();
    const [total, items] = await Promise.all([getItemCount(), getRecentlyAddedItems(FETCH_LIMIT)]);
    const newest = items[0]?.DateCreated ?? null;

    const countRow = await prisma.serverConfig.findUnique({ where: { key: COUNT_KEY } });
    const dateRow = await prisma.serverConfig.findUnique({ where: { key: DATE_KEY } });
    const prevCount = countRow?.value != null ? Number(countRow.value) : null;
    const watermark = dateRow?.value ? new Date(dateRow.value).getTime() : null;

    console.log(
      `[LibNotif] poll(${reason}): count=${total ?? "∅"} (prev=${prevCount ?? "∅"}) | ` +
        `top="${items[0]?.Name ?? "∅"}" created=${newest ?? "∅"} | wm=${dateRow?.value ?? "∅"}`,
    );

    // 1er run : baseline (mémorise count + date sans notifier l'existant).
    if (prevCount === null || watermark === null) {
      if (total !== null) await setKey(COUNT_KEY, String(total));
      if (newest) await setKey(DATE_KEY, newest);
      console.log(`[LibNotif] baseline (count=${total ?? "∅"}, date=${newest ?? "∅"})`);
      return;
    }

    const fresh = items.filter((i) => i.DateCreated && new Date(i.DateCreated).getTime() > watermark);
    const countDelta = total !== null ? total - prevCount : 0;

    // Rafraîchit toujours les repères (gère aussi les suppressions).
    if (total !== null) await setKey(COUNT_KEY, String(total));
    if (newest) await setKey(DATE_KEY, newest);

    if (fresh.length === 0 && countDelta <= 0) return; // rien de neuf

    const prefs = await prisma.notificationPreference.findMany({
      where: { libraryAdded: true },
      select: { jellyfinUserId: true },
    });
    console.log(`[LibNotif] nouveau : fresh=${fresh.length}, countDelta=${countDelta} → ${prefs.length} destinataire(s)`);
    if (prefs.length === 0) return;

    const { title, body } = fresh.length > 0 ? compose(fresh) : composeGeneric(Math.max(countDelta, 1));
    const res = await sendToUsers(prefs.map((p) => p.jellyfinUserId), {
      title,
      body,
      data: { type: "library_added" },
    });
    console.log(`[LibNotif] push « ${title} » → ${JSON.stringify(res)}`);
  } catch (err) {
    console.error("[LibNotif] poll échoué:", err);
  } finally {
    running = false;
  }
}

/** Titre/corps quand on a les items (date récente) : regroupe les épisodes par série. */
function compose(
  items: { Name: string; Type: string; SeriesName?: string }[],
): { title: string; body: string } {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const label = it.Type === "Episode" ? it.SeriesName ?? it.Name : it.Name;
    if (label && !seen.has(label)) { seen.add(label); labels.push(label); }
  }
  if (labels.length === 1) {
    return { title: "Nouveau contenu", body: `« ${labels[0]} » vient d'être ajouté` };
  }
  const preview = labels.slice(0, 3).join(", ");
  const extra = labels.length > 3 ? ` +${labels.length - 3}` : "";
  return { title: `${labels.length} nouveautés ajoutées`, body: `${preview}${extra}` };
}

/** Titre/corps générique : count monté mais sans item daté récent (date fichier). */
function composeGeneric(n: number): { title: string; body: string } {
  return n === 1
    ? { title: "Nouveau contenu", body: "Un nouveau contenu vient d'être ajouté" }
    : { title: `${n} nouveautés ajoutées`, body: "De nouveaux contenus viennent d'être ajoutés" };
}
