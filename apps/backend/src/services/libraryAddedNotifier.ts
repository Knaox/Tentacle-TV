import { getRecentlyAddedItems } from "./jellyfin";
import { getPrisma, hasPrisma } from "./db";
import { sendToUsers } from "./pushService";

// Notifie en push les utilisateurs opted-in (NotificationPreference.libraryAdded)
// des nouveaux ajouts en bibliothèque. Détection ROBUSTE par POLL de l'API
// Jellyfin (recently added) + watermark persisté (ServerConfig) — ne dépend PAS
// de l'event WebSocket, qui peut manquer ou arriver sans items. Le WS ne sert
// plus qu'à déclencher un poll immédiat (accélérateur). Un seul détecteur (le
// poll) → aucun doublon. Push direct, pas de ligne Notification in-app.

const POLL_INTERVAL = 60_000;
const WS_DEBOUNCE_MS = 8_000;
const FETCH_LIMIT = 40;
const WATERMARK_KEY = "lib_notif_watermark"; // ISO DateCreated du dernier item traité

let pollTimer: ReturnType<typeof setInterval> | null = null;
let wsTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

export function startLibraryAddedNotifier(): void {
  if (pollTimer) return;
  console.log("[LibNotif] Démarrage détection ajouts (poll 60s + WS)");
  pollTimer = setInterval(() => void poll("interval"), POLL_INTERVAL);
  setTimeout(() => void poll("boot"), 8_000); // baseline peu après le démarrage
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

async function saveWatermark(iso: string): Promise<void> {
  await getPrisma().serverConfig.upsert({
    where: { key: WATERMARK_KEY },
    update: { value: iso },
    create: { key: WATERMARK_KEY, value: iso },
  });
}

async function poll(reason: string): Promise<void> {
  if (running || !hasPrisma()) return;
  running = true;
  try {
    const prisma = getPrisma();
    const items = await getRecentlyAddedItems(FETCH_LIMIT);
    if (items.length === 0) return;
    const newest = items[0].DateCreated;
    if (!newest) return;

    const row = await prisma.serverConfig.findUnique({ where: { key: WATERMARK_KEY } });
    // 1er run (pas de watermark) : on établit le baseline sans notifier l'existant.
    if (!row?.value) {
      await saveWatermark(newest);
      console.log(`[LibNotif] baseline établie (${newest}) — pas de notif au démarrage`);
      return;
    }

    const watermark = new Date(row.value).getTime();
    const fresh = items.filter((i) => i.DateCreated && new Date(i.DateCreated).getTime() > watermark);
    if (fresh.length === 0) return;

    await saveWatermark(newest); // avance AVANT l'envoi (anti-doublon si crash)

    const prefs = await prisma.notificationPreference.findMany({
      where: { libraryAdded: true },
      select: { jellyfinUserId: true },
    });
    console.log(`[LibNotif] poll(${reason}) : ${fresh.length} nouveau(x), ${prefs.length} destinataire(s) opted-in`);
    if (prefs.length === 0) return;

    const { title, body } = compose(fresh);
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

/** Compose un titre/corps lisible, en regroupant les épisodes par série. */
function compose(
  items: { Name: string; Type: string; SeriesName?: string }[],
): { title: string; body: string } {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const label = it.Type === "Episode" ? it.SeriesName ?? it.Name : it.Name;
    if (label && !seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  if (labels.length === 1) {
    return { title: "Nouveau contenu", body: `« ${labels[0]} » vient d'être ajouté` };
  }
  const preview = labels.slice(0, 3).join(", ");
  const extra = labels.length > 3 ? ` +${labels.length - 3}` : "";
  return { title: `${labels.length} nouveautés ajoutées`, body: `${preview}${extra}` };
}
