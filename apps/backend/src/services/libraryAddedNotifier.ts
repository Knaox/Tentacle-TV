import { getItemCount, getAllLibraryItemIds, getItemsByIds, type LibItem } from "./jellyfinLibrary";
import { hasPrisma } from "./db";
import { sendToUser } from "./pushService";
import { composeItems, composeRequested, pushTarget } from "./libraryAddedFormat";
import { resolveSeriesTmdbIds } from "./libraryAddedSeries";
import { libraryIdentityKeys, librarySeasonKeys, librarySeriesKeys, recordAnnounced, refreshAnnounced } from "./announcedRegistry";
import { planRecipients, type RecipientPlan } from "./libraryAddedRecipients";
import { ArrivalHold } from "./libraryArrivalHold";
import {
  backfillPresenceKeys,
  classifyArrivals,
  loadPresentIds,
  presenceKey,
  purgeDepartures,
  recordArrivals,
  recordDepartures,
} from "./libraryPresence";
import { forgetRemovedSeries, restoreAutoRetiredSeries } from "./watchlistAutoRetired";

// Les arrivées dans la bibliothèque, annoncées en push dès que JELLYFIN les a —
// sans attendre que Jellyseerr les voie. Chaîne :
//  1. Détection par DIFF d'IDs (robuste vs date de fichier ET WS muet), sur un
//     instantané PERSISTANT (library_known_id : rattrape une coupure serveur).
//     Le WS LibraryChanged n'est qu'un accélérateur.
//  2. Attente (libraryArrivalHold) : les nouveaux IDs attendent que la
//     bibliothèque se taise, et leurs métadonnées — une saison rangée en
//     plusieurs vagues part en une annonce.
//  3. Reconnaissance (libraryPresence) : un fichier remplacé (mise à niveau,
//     déplacement) ou une seconde version n'est pas une nouveauté.
//  4. Destinataires (libraryAddedRecipients) : le demandeur, et les abonnés
//     à tous les ajouts ; le registre announced_contents écarte ce qui vient
//     d'être annoncé, y compris par le pipeline Seer.
// Le même diff nourrit le retour automatique dans « Ma liste » des séries
// sorties parce que tout était vu (watchlistAutoRetired), hors préférences push.

const POLL_INTERVAL = 60_000;
const WS_DEBOUNCE_MS = 8_000;
/** Des items ne font plus qu'attendre leurs métadonnées : on repasse à ce rythme. */
const DEFER_RECHECK_MS = 30_000;
const NAME_CHUNK = 100; // IDs par appel getItemsByIds (longueur d'URL)
const DEPARTURE_PURGE_EVERY_MS = 6 * 60 * 60_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let wsTimer: ReturnType<typeof setTimeout> | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let wsSignal = false; // un LibraryChanged force le diff même à décompte stable
let knownIds: Set<string> | null = null; // IDs présents, chargés au 1er poll
let backfillStarted = false;
let lastDeparturePurge = 0;
const hold = new ArrivalHold();

/** Métadonnées prêtes pour un titre propre et une reconnaissance fiable ? */
function isReady(it: LibItem): boolean {
  if (it.Type === "Episode") {
    return it.SeriesName != null && it.ParentIndexNumber != null && it.IndexNumber != null;
  }
  // Film : attendre AUSSI le TMDB (ProviderIds.Tmdb, indexé en asynchrone) —
  // c'est sa clé de contenu et ce qui le relie à une demande.
  if (it.Type === "Movie") return !!it.Name && it.tmdbId != null;
  return true;
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
  if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
}

/** WS LibraryChanged : un diff complet, débouncé. */
export function poke(_itemIds?: unknown): void {
  wsSignal = true;
  if (wsTimer) clearTimeout(wsTimer);
  wsTimer = setTimeout(() => void poll("ws"), WS_DEBOUNCE_MS);
}

/** Revenir voir quand l'attente arrive à échéance. */
function scheduleSettleCheck(): void {
  if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
  const at = hold.nextCheckAt();
  if (at === null || !pollTimer) return;
  const delay = at > Date.now() ? at - Date.now() : DEFER_RECHECK_MS;
  settleTimer = setTimeout(() => { settleTimer = null; void poll("attente"); }, delay);
}

/** Reconnaissance des items d'avant cette version : une fois, en tâche de fond. */
function startBackfill(): void {
  if (backfillStarted) return;
  backfillStarted = true;
  void backfillPresenceKeys()
    .then((n) => { if (n > 0) console.log(`[LibNotif] contenus reconnus : ${n} items`); })
    .catch((err) => console.error("[LibNotif] reconnaissance des contenus échouée:", err));
}

/** Métadonnées pour des IDs, par lots (longueur d'URL). */
async function itemsForIds(ids: string[]): Promise<LibItem[]> {
  const out: LibItem[] = [];
  for (let i = 0; i < ids.length; i += NAME_CHUNK) {
    out.push(...(await getItemsByIds(ids.slice(i, i + NAME_CHUNK))));
  }
  return out;
}

/** Le TMDB de la SÉRIE de chaque épisode : c'est lui que portent les demandes. */
async function attachSeriesTmdb(items: LibItem[]): Promise<void> {
  const seriesIds = [...new Set(items.filter((it) => it.SeriesId).map((it) => it.SeriesId as string))];
  if (seriesIds.length === 0) return;
  const tmdb = await resolveSeriesTmdbIds(seriesIds);
  for (const it of items) if (it.SeriesId) it.seriesTmdbId = tmdb.get(it.SeriesId);
}

/** Un envoi (ses demandes, ou les autres nouveautés) et ce qu'il couvre au registre. */
async function deliver(plan: RecipientPlan, items: LibItem[], requested: boolean, now: number): Promise<void> {
  if (items.length === 0) return;
  const text = requested ? composeRequested(items, plan.lang) : composeItems(items, plan.lang);
  const res = await sendToUser(plan.userId, { ...text, data: { type: "library_added", refId: pushTarget(items) } });
  await recordAnnounced(plan.userId, [...items.flatMap(libraryIdentityKeys), ...items.flatMap(librarySeriesKeys)]);
  await refreshAnnounced(plan.userId, items.flatMap(librarySeasonKeys), now);
  console.log(
    `[LibNotif] push[${plan.userId.slice(0, 8)}] ${requested ? "demande" : "nouveautés"} « ${text.title} » (sent:${res.sent})`,
  );
}

async function announce(news: LibItem[], now: number): Promise<void> {
  for (const plan of await planRecipients(news, now)) {
    await deliver(plan, plan.requested, true, now);
    await deliver(plan, plan.others, false, now);
    if (plan.absorbed.length > 0) await recordAnnounced(plan.userId, plan.absorbed.flatMap(libraryIdentityKeys));
  }
}

/** Relâche l'attente : ce qui est prêt est reconnu, annoncé, puis enregistré. */
async function release(now: number): Promise<void> {
  const ids = hold.ids();
  const byId = new Map((await itemsForIds(ids)).map((it) => [it.Id, it] as const));
  await attachSeriesTmdb([...byId.values()]);

  const released: string[] = [];
  const items: LibItem[] = [];
  for (const id of ids) {
    const it = byId.get(id);
    // Pas prêt (ou pas encore lisible) : il attend encore, dans la limite.
    if ((!it || !isReady(it)) && hold.canWait(id, now)) continue;
    released.push(id);
    if (it) items.push(it);
  }
  if (released.length === 0) return;

  const verdict = await classifyArrivals(items, now);
  // Annoncer d'abord, enregistrer ensuite : un plantage entre les deux fait
  // re-détecter l'arrivée, et le registre par utilisateur écarte le doublon.
  if (verdict.news.length > 0) {
    // La remise dans Ma liste d'abord (elle ne lève jamais), le push ensuite.
    await restoreAutoRetiredSeries(verdict.news);
    await announce(verdict.news, now);
  }
  const keyOf = new Map(items.map((it) => [it.Id, presenceKey(it)] as const));
  await recordArrivals(released.map((itemId) => ({ itemId, contentKey: keyOf.get(itemId) ?? null })));
  hold.release(released);
  for (const id of released) knownIds?.add(id);
  console.log(
    `[LibNotif] relâchés=${released.length}, nouveautés=${verdict.news.length}, déjà là=${verdict.known.length}, en attente=${hold.size}`,
  );
}

async function poll(reason: string): Promise<void> {
  if (running || !hasPrisma()) return;
  running = true;
  try {
    const forced = wsSignal;
    wsSignal = false;

    // Charge l'instantané persistant au 1er passage (survit aux redémarrages).
    if (knownIds === null) {
      knownIds = await loadPresentIds();
      console.log(`[LibNotif] instantané chargé: ${knownIds.size} ids`);
      if (knownIds.size > 0) startBackfill();
    }

    const total = await getItemCount();

    // Instantané vide = jamais initialisé → baseline (peupler sans notifier l'existant).
    if (knownIds.size === 0) {
      const ids = await getAllLibraryItemIds();
      if (ids.length > 0) {
        await recordArrivals(ids.map((itemId) => ({ itemId, contentKey: null })));
        knownIds = new Set(ids);
        startBackfill();
      }
      console.log(`[LibNotif] baseline (count=${total ?? "∅"}, ids=${ids.length})`);
      return;
    }

    // Garde-fou : décompte stable, pas de signal WS, rien en attente → pas de diff paginé.
    if (total !== null && total === knownIds.size && !forced && hold.size === 0) return;

    const currentIds = await getAllLibraryItemIds();
    if (currentIds.length === 0) return; // échec fetch → ne rien toucher, réessai au prochain poll

    const now = Date.now();
    const currentSet = new Set(currentIds);
    const newIds = currentIds.filter((id) => !knownIds!.has(id));
    const removedIds = [...knownIds].filter((id) => !currentSet.has(id));
    if (removedIds.length > 0) {
      await recordDepartures(removedIds, now);
      for (const id of removedIds) knownIds.delete(id);
      await forgetRemovedSeries(removedIds);
    }
    const before = hold.size;
    hold.observe(newIds, now);
    if (hold.size !== before || removedIds.length > 0) {
      console.log(`[LibNotif] diff(${reason}): en attente=${hold.size}, partis=${removedIds.length}`);
    }
    if (hold.isSettled(now)) await release(now);

    if (now - lastDeparturePurge >= DEPARTURE_PURGE_EVERY_MS) {
      lastDeparturePurge = now;
      const purged = await purgeDepartures(now);
      if (purged > 0) console.log(`[LibNotif] départs oubliés (> 30 j) : ${purged}`);
    }
  } catch (err) {
    console.error("[LibNotif] poll échoué:", err);
  } finally {
    running = false;
    scheduleSettleCheck();
  }
}
