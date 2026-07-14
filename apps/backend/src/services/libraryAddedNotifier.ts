import { getItemsByIds } from "./jellyfin";
import { getPrisma, hasPrisma } from "./db";
import { sendToUsers } from "./pushService";

// Notifie en push les utilisateurs opted-in (NotificationPreference.libraryAdded)
// des nouveaux ajouts en bibliothèque. Détection : événement WebSocket Jellyfin
// « LibraryChanged » (cf. jellyfinWs). Push DIRECT — pas de ligne Notification
// in-app — pour ne pas inonder la cloche. Débounce + regroupement : une saison
// entière ajoutée = N événements → une seule notification lisible.

const DEBOUNCE_MS = 20_000;
const MAX_BUFFER = 200;

const buffer = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Empile des IDs d'items ajoutés (venus de LibraryChanged) et (ré)arme le débounce. */
export function enqueue(itemIds: unknown): void {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    console.log(`[LibNotif] LibraryChanged: ItemsAdded vide/absent (${Array.isArray(itemIds) ? "[]" : typeof itemIds})`);
    return;
  }
  for (const id of itemIds) {
    if (typeof id === "string" && id) buffer.add(id);
    if (buffer.size >= MAX_BUFFER) break;
  }
  if (buffer.size === 0) return;
  console.log(`[LibNotif] LibraryChanged: +${itemIds.length} ItemsAdded (buffer=${buffer.size}), flush dans ${DEBOUNCE_MS / 1000}s`);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), DEBOUNCE_MS);
}

async function flush(): Promise<void> {
  timer = null;
  const ids = [...buffer];
  buffer.clear();
  if (ids.length === 0 || !hasPrisma()) return;

  try {
    const prisma = getPrisma();
    // Destinataires : utilisateurs ayant activé libraryAdded. Si personne n'est
    // abonné, inutile d'interroger Jellyfin.
    const prefs = await prisma.notificationPreference.findMany({
      where: { libraryAdded: true },
      select: { jellyfinUserId: true },
    });
    console.log(`[LibNotif] flush: ${ids.length} ajout(s), ${prefs.length} destinataire(s) opted-in`);
    if (prefs.length === 0) return;
    const userIds = prefs.map((p) => p.jellyfinUserId);

    const items = await getItemsByIds(userIds[0], ids);
    const relevant = items.filter((i) => ["Movie", "Series", "Episode"].includes(i.Type));
    console.log(`[LibNotif] ${items.length} item(s) résolu(s), ${relevant.length} pertinent(s)`);
    if (relevant.length === 0) return;

    const { title, body } = compose(relevant);
    const res = await sendToUsers(userIds, { title, body, data: { type: "library_added" } });
    console.log(`[LibNotif] push « ${title} » → ${JSON.stringify(res)}`);
  } catch (err) {
    console.error("[LibNotif] flush échoué:", err);
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
