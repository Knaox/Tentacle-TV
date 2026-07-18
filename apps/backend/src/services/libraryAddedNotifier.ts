import { getItemCount, getAllLibraryItemIds, getItemsByIds, type LibItem } from "./jellyfin";
import { getPrisma, hasPrisma } from "./db";
import { sendToUser } from "./pushService";
import { composeItems } from "./libraryAddedFormat";
import { indexClaims, isClaimed } from "./libraryAddedDedup";
import { resolveSeriesTmdbIds } from "./libraryAddedSeries";
import { filterAnnounced, libraryContentKeys, recordAnnounced } from "./announcedRegistry";

// Notifie en push les ajouts bibliothèque. Détection + nommage par DIFF d'IDs
// (robuste vs date fichier ET WS muet). Instantané PERSISTANT (table
// library_known_id → rattrape les ajouts faits pendant une coupure serveur).
// Anti-doublon : registre persistant announced_contents (une annonce par
// contenu et par utilisateur, restarts et pipeline Seer compris). Contenus
// revendiqués par un plugin (content_claims, ex. Seer) : annoncés côté biblio
// à PERSONNE d'autre que leur demandeur — règle produit : une demande ne
// regarde que celui qui l'a faite (le pipeline Seer, adossé à la vérité
// Jellyfin, notifie le demandeur) ; le demandeur lui-même ne garde la notif
// biblio que si la notif Seer ne prend pas le relais (seerAvailable off).

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
const deferCount = new Map<string, number>(); // itemId → reports (métadonnées Jellyfin pas prêtes)
const MAX_DEFER = 5; // au-delà, on notifie avec le Name brut (métadonnées jamais venues)

/** Métadonnées prêtes pour un titre propre ? (épisode : nom de série + numéros requis). */
function isReady(it: LibItem): boolean {
  if (it.Type === "Episode") return it.SeriesName != null && it.IndexNumber != null;
  // Film/série : attendre AUSSI le tmdbId (ProviderIds.Tmdb, indexé en asynchrone
  // par Jellyfin) pour que l'anti-doublon Seer matche par identifiant TMDB et non
  // par titre. Le filet MAX_DEFER notifie quand même au bout de 5 reports.
  if (it.Type === "Movie" || it.Type === "Series") return !!it.Name && it.tmdbId != null;
  return !!it.Name;
}

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

/** Envoi PAR UTILISATEUR avec filtrage anti-doublon (claims plugins). */
async function notifyNamed(named: LibItem[]): Promise<void> {
  const prisma = getPrisma();
  const prefs = await prisma.notificationPreference.findMany({
    where: { libraryAdded: true }, select: { jellyfinUserId: true, seerAvailable: true },
  });
  if (prefs.length === 0) return;

  // Résout le tmdbId de la SÉRIE parente des épisodes (via les SeriesId uniques)
  // → l'anti-doublon Seer matche par identifiant TMDB, pas par titre (langue).
  const seriesIds = [...new Set(named.filter((it) => it.SeriesId).map((it) => it.SeriesId!))];
  if (seriesIds.length > 0) {
    const seriesTmdb = await resolveSeriesTmdbIds(seriesIds);
    for (const it of named) {
      if (it.SeriesId) it.seriesTmdbId = seriesTmdb.get(it.SeriesId);
    }
  }

  const claims = await prisma.contentClaim.findMany({
    where: { expiresAt: { gt: new Date() } },
    select: { tmdbId: true, jellyfinUserId: true, title: true },
  });
  const claimIndex = indexClaims(claims);
  // Ensemble GLOBAL des claims (tous demandeurs confondus) : un contenu arrivé
  // via une demande Seer n'est annoncé ici à personne d'autre que son demandeur.
  const allClaims = indexClaims(claims.map((c) => ({ ...c, jellyfinUserId: "*" }))).get("*");

  // Clés multi-alias (tmdb + titre) calculées une fois — le registre persistant
  // announced_contents remplace l'ancien cache RAM 6 h (clé instable titre→tmdb,
  // perdu au restart) : anti « saison éclatée » ET anti re-notification, par
  // utilisateur, quel que soit le pipeline qui a annoncé en premier.
  const keySets = named.map(libraryContentKeys);

  for (const p of prefs) {
    const announced = await filterAnnounced(p.jellyfinUserId, keySets);
    // Enrichissement d'alias : un contenu déjà annoncé (via son alias titre)
    // dont le tmdb vient d'être résolu enregistre AUSSI son alias tmdb — le
    // matching croisé Seer ↔ biblio reste complet malgré la résolution tardive.
    const aliasKeys = named.filter((_, i) => announced[i]).flatMap(libraryContentKeys);
    if (aliasKeys.length > 0) await recordAnnounced(p.jellyfinUserId, aliasKeys);
    let items = named.filter((_, i) => !announced[i]);
    // Contenus issus d'une demande Seer : jamais annoncés à quelqu'un d'AUTRE
    // que le demandeur. Pour le demandeur lui-même : supprimé seulement si la
    // notif Seer prend le relais (seerAvailable) — sinon la notif biblio reste
    // son seul signal (comportement 1.5.5 conservé pour ses propres demandes).
    const own = claimIndex.get(p.jellyfinUserId);
    items = items.filter((it) => {
      if (!isClaimed(it, allClaims)) return true;
      if (isClaimed(it, own)) return !p.seerAvailable;
      return false;
    });
    if (items.length === 0) continue;
    const { title, body } = composeItems(items);
    await sendToUser(p.jellyfinUserId, { title, body, data: { type: "library_added" } });
    await recordAnnounced(p.jellyfinUserId, items.flatMap(libraryContentKeys));
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

    // Rien de neuf (juste des suppressions éventuelles) → MAJ silencieuse.
    if (newIds.length === 0) {
      if (removedIds.length > 0) { await persistDelta([], removedIds); knownIds = currentSet; }
      return;
    }

    // Jellyfin peuple les métadonnées (série, numéros, vrai titre) de façon
    // ASYNCHRONE après l'ajout : au tout début, Name = nom de fichier brut. On
    // DIFFÈRE les items pas encore prêts (hors knownIds) pour les re-tenter au
    // prochain poll → titres propres ET regroupement « Saison N » correct.
    const byId = new Map((await namesForIds(newIds)).map((it) => [it.Id, it] as const));
    const readyIds: string[] = [];
    const readyItems: LibItem[] = [];
    const deferIds: string[] = [];
    for (const id of newIds) {
      const it = byId.get(id);
      const tries = deferCount.get(id) ?? 0;
      if (!it || isReady(it) || tries >= MAX_DEFER) {
        deferCount.delete(id);
        readyIds.push(id);
        if (it && NAMED_TYPES.includes(it.Type)) readyItems.push(it);
      } else {
        deferCount.set(id, tries + 1);
        deferIds.push(id);
      }
    }

    // Commit UNIQUEMENT les items prêts ; les différés restent hors knownIds
    // (re-détectés au prochain poll ; le count-gate se rouvre tant qu'il en reste).
    const deferSet = new Set(deferIds);
    await persistDelta(readyIds, removedIds);
    knownIds = new Set(currentIds.filter((id) => !deferSet.has(id)));

    console.log(`[LibNotif] diff(${reason}): nouveaux=${newIds.length}, prêts=${readyItems.length}, différés=${deferIds.length}, retirés=${removedIds.length}`);
    if (readyItems.length > 0) await notifyNamed(readyItems);
  } catch (err) {
    console.error("[LibNotif] poll échoué:", err);
  } finally {
    running = false;
  }
}
