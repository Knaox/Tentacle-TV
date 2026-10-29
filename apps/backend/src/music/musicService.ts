/**
 * Octave — la musique de la bibliothèque Jellyfin, côté serveur : le passage
 * complet de l'index au démarrage (en fond, quinze secondes après, pour ne pas
 * disputer Jellyfin au reste du démarrage), puis les évènements des sockets de
 * comptes. L'index déjà rempli d'une exécution précédente sert pendant ce
 * passage : seuls les changements survenus serveur éteint arrivent avec lui.
 */

import { countsByKind } from "./index/indexQueries";
import { fullSync, markIndexUsable, syncState } from "./index/indexSync";
import { scheduleOrphanReread } from "./index/orphanReread";
import { onJellyfinLibraryChanged, tellLibrary } from "./events/musicLiveEvents";
import { onLibraryChanged } from "../services/jellyfinLibraryListeners";
import { onAudioItems } from "./events/audioItemsFeed";
import { sourceArrivalWatcher } from "./playlistSource/sourceArrivals";

const START_DELAY_MS = 15_000;
/** Un passage complet en échec (Jellyfin muet) se retente à la demande, pas plus d'une fois par minute. */
const RETRY_MS = 60_000;
let started = false;
let timer: NodeJS.Timeout | null = null;
let lastAttempt = 0;

async function kickOff(): Promise<void> {
  lastAttempt = Date.now();
  const counts = await countsByKind().catch(() => null);
  // Un index déjà rempli répond tout de suite ; le passage complet le remet à jour derrière.
  if (counts && counts.track + counts.album + counts.artist > 0) markIndexUsable();
  const changes = await fullSync();
  // Les titres rangés sans album (lus avant leurs tags) : Jellyfin les relit, peu à la fois.
  if (syncState().lastFullAt !== null) scheduleOrphanReread();
  // Ce qui a changé serveur éteint (ou avant ce passage) se dit aussi aux comptes connectés.
  if (changes && changes.added.length + changes.removed.length > 0) await tellLibrary(changes).catch(() => undefined);
}

/** Dès le démarrage : un index déjà rempli répond (et suit les évènements) avant le passage complet. */
async function markUsableEarly(): Promise<void> {
  const counts = await countsByKind().catch(() => null);
  if (counts && counts.track + counts.album + counts.artist > 0) markIndexUsable();
}

/** Lancé avec les tâches de fond d'un serveur installé (`backgroundServices.ts`). */
export function startMusicIndex(): void {
  if (started) return;
  started = true;
  // Une arrivée se range à son rang dans les playlists importées qui l'attendaient (playlistSource/sourceArrivals.ts).
  onAudioItems(sourceArrivalWatcher().onChange);
  // Les `LibraryChanged` des sockets de comptes tiennent l'index à jour.
  onLibraryChanged((change) =>
    void onJellyfinLibraryChanged({ ItemsAdded: change.added, ItemsUpdated: change.updated, ItemsRemoved: change.removed }),
  );
  void markUsableEarly();
  timer = setTimeout(() => {
    timer = null;
    void kickOff();
  }, START_DELAY_MS);
  timer.unref?.();
}

/** Une requête musique avant le passage différé : il part tout de suite. */
export function ensureMusicIndex(): void {
  if (!started) started = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
    void kickOff();
    return;
  }
  const state = syncState();
  if (!state.running && state.lastFullAt === null && Date.now() - lastAttempt > RETRY_MS) void kickOff();
}

export function resetMusicServiceForTests(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  started = false;
  lastAttempt = 0;
}
