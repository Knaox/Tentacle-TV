import { getItemsByIdsAdmin } from "./jellyfin";
import { getPrisma, hasPrisma } from "./db";
import { sendToUsers } from "./pushService";

// Notifie en push les utilisateurs opted-in (NotificationPreference.libraryAdded)
// des nouveaux ajouts en bibliothèque. Détection : événement WebSocket Jellyfin
// « LibraryChanged » (cf. jellyfinWs). Push DIRECT — pas de ligne Notification
// in-app — pour ne pas inonder la cloche. Débounce + regroupement : une saison
// entière ajoutée = N événements → une seule notification lisible.

const DEBOUNCE_MS = 45_000;
const MAX_BUFFER = 200;

const buffer = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Empile des IDs d'items ajoutés (venus de LibraryChanged) et (ré)arme le débounce. */
export function enqueue(itemIds: unknown): void {
  if (!Array.isArray(itemIds)) return;
  for (const id of itemIds) {
    if (typeof id === "string" && id) buffer.add(id);
    if (buffer.size >= MAX_BUFFER) break;
  }
  if (buffer.size === 0) return;
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
    if (prefs.length === 0) return;
    const userIds = prefs.map((p) => p.jellyfinUserId);

    const items = await getItemsByIdsAdmin(ids);
    const relevant = items.filter((i) => ["Movie", "Series", "Episode"].includes(i.Type));
    if (relevant.length === 0) return;

    const { title, body } = compose(relevant);
    await sendToUsers(userIds, { title, body, data: { type: "library_added" } });
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
