/**
 * L'arrêt de mpv sur macOS — le seul endroit qui a demandé trois tentatives.
 *
 * # Le problème, en une image
 *
 * ⚠️ Les DEUX fonctions de destruction de libmpv bloquent le thread appelant,
 * et sur macOS ce thread est justement celui dont mpv a besoin pour finir :
 *
 *   com.apple.main-thread                 thread vidéo de mpv
 *     mp_destroy_client                     vo_thread
 *       uninit_video_out                      gpu_ctx_destroy
 *         vo_destroy                            ra_ctx_destroy
 *           pthread_join ─── attend ──────────────┘ ── attend le thread principal
 *
 * Chacun attend l'autre. L'application se fige sans consommer de processeur, ne
 * répond plus, et ne meurt même plus à la fermeture — il faut la tuer de force.
 * Constaté en phase 1 sur proto, puis reproduit ici au banc avant d'écrire ce
 * fichier : `destroy()` ne rendait jamais la main.
 *
 * # Ce qui ne marche PAS
 *
 *  - `mpv_terminate_destroy` : bloque, par construction — elle attend l'arrêt
 *    complet du cœur, sortie vidéo comprise.
 *  - `mpv_destroy` seul : bloque aussi dès lors qu'on est le dernier client,
 *    car c'est alors lui qui emporte le cœur.
 *  - `quit`, puis attendre `shutdown`, puis `mpv_destroy` : bloque ENCORE.
 *    `shutdown` ne signifie pas « tout est démonté » mais « le client doit
 *    partir » — la sortie vidéo vit toujours à cet instant.
 *
 * # Ce qui marche
 *
 * Démonter la sortie vidéo D'ABORD, et attendre qu'elle ait vraiment disparu,
 * en rendant la main à la boucle d'évènements entre chaque étape :
 *
 *   1. `force-window=no` + `stop` — le démontage commence sur les threads de
 *      mpv, que le thread principal est libre de servir ;
 *   2. on guette la disparition de la fenêtre vidéo ;
 *   3. `quit` — le cœur s'arrête, `shutdown` arrive ;
 *   4. `mpv_destroy` — il n'y a plus de sortie vidéo, plus rien ne bloque.
 *
 * **Windows n'emprunte pas ce chemin** : sa fenêtre vidéo est une fenêtre
 * enfant Win32 sans couplage au thread principal, et `destroy()` y rend la main
 * depuis toujours. On ne touche pas à ce qui est en production.
 */

import { mpvApi } from "./mpvFfi";
import { clearState, handle, setOnShutdown, setHandle } from "./mpv";

/**
 * Délai au-delà duquel on cesse d'attendre.
 *
 * Trois secondes suffisent très largement. Passé ce délai on abandonne la
 * poignée SANS la libérer : une poignée perdue coûte quelques octets jusqu'à la
 * fin du processus, une application qui ne se ferme plus coûte bien plus cher.
 */
const SHUTDOWN_DELAY_MS = 3000;
/** Cadence du guet, et nombre maximal de tours avant de passer outre. */
const WATCH_MS = 50;
const WATCH_MAX = 20;

/**
 * Arrête mpv sans figer l'application.
 *
 * `videoIsGone` témoigne de la disparition de la fenêtre vidéo ; sans lui, on se
 * contente d'un nombre de tours fixe, ce qui est moins sûr.
 */
export function stop(videoIsGone?: () => boolean): Promise<void> {
  const ctx = handle();
  if (!ctx) {
    clearState();
    return Promise.resolve();
  }

  // Étape 1 : démonter la sortie vidéo. `quit` n'est PAS envoyé ici — il
  // doublerait `stop` et ne laisserait pas au démontage le temps d'aboutir.
  //
  // ⚠️ `set` par la file de commandes, JAMAIS `mpv_set_property_string` : cette
  // dernière prend `mp_dispatch_lock` et attend le cœur de mpv, qui attend le
  // thread principal — celui qui appelle (voir `mpv.ts`). Et l'instant est le
  // pire de tous : la sortie vidéo est encore debout, donc mpv a précisément
  // besoin de ce thread. Les deux commandes partent dans l'ordre d'envoi, mpv
  // les traite dans le même.
  mpvApi().commandAsync(ctx, 0, ["set", "force-window", "no", null]);
  mpvApi().commandAsync(ctx, 0, ["stop", null]);

  return new Promise<void>((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      setOnShutdown(null);
      clearTimeout(limit);
      clearInterval(watch);
      clearState();
      resolve();
    };

    const limit = setTimeout(() => {
      setHandle(null);
      finish();
    }, SHUTDOWN_DELAY_MS);

    setOnShutdown(() => {
      const still = handle();
      if (still) mpvApi().destroyClient(still);
      setHandle(null);
      finish();
    });

    // Étape 2 : la fenêtre vidéo a disparu, on peut demander `quit`.
    let ticks = 0;
    const watch = setInterval(() => {
      ticks += 1;
      const gone = videoIsGone === undefined ? ticks >= 10 : videoIsGone();
      if (!gone && ticks < WATCH_MAX) return;
      clearInterval(watch);
      const still = handle();
      if (still) mpvApi().commandAsync(still, 0, ["quit", null]);
    }, WATCH_MS);
  });
}
