import { startRecoJobs } from "./reco/jobs";
import { startSearchJobs } from "./search/jobs";
import { startPairingCleanup } from "./pairingCleanup";
import { startFamilySweep } from "./family/familySweep";
import { startJellyfinPoller } from "./jellyfinPoller";
import { startJellyfinWs } from "./jellyfinWs";
import { startNotificationPushWorker } from "./notificationPushWorker";
import { startTicketLifecycleWorker } from "./ticketLifecycle";
import { startLibraryAddedNotifier } from "./libraryAddedNotifier";
import { backfillSwipeFavorites } from "./swipe/swipeFavoritesBackfill";
import { startAnnouncedPurge } from "./announcedRegistry";
import { startNotificationPurge } from "./notificationPurge";
import { sweepStaleTempDirs } from "./audioFingerprint";
import { purgeEmptyAudioVerdicts } from "./audioAnalysis";
import { purgeObsoleteTailRows } from "./tailAnalysis/tailStore";
import { startWatchTime } from "./watchTime/collector";

/**
 * Les tâches de fond d'un serveur INSTALLÉ, lancées une seule fois par
 * processus, d'où qu'on les demande : au démarrage, à la reprise d'une base
 * revenue, ou à la fin de l'assistant — sans redémarrage. (Les modules
 * serveur des plugins, eux, ne se chargent qu'au démarrage : Fastify n'ajoute
 * plus de route une fois à l'écoute.)
 */
let started = false;

export function startBackgroundServices(): void {
  if (started) return;
  started = true;
  startPairingCleanup();
  startFamilySweep();
  startJellyfinPoller();
  startJellyfinWs();
  startNotificationPushWorker();
  startTicketLifecycleWorker();
  startLibraryAddedNotifier();
  // Une fois par serveur : les likes d'Affiner d'avant le cœur deviennent des cœurs.
  void backfillSwipeFavorites();
  startAnnouncedPurge();
  startNotificationPurge();
  // Analyses audio et de fin de média : les temporaires d'une analyse
  // interrompue, et ce qui a été rangé sans rien avoir trouvé (on ne range
  // plus que les trouvailles).
  void sweepStaleTempDirs();
  void purgeObsoleteTailRows();
  void purgeEmptyAudioVerdicts();
  startWatchTime();
  startRecoJobs();
  // Le moteur de recherche : son index se construit peu après le démarrage.
  startSearchJobs();
}

export function backgroundServicesStarted(): boolean {
  return started;
}
