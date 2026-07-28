/**
 * Instance mpv : cycle de vie, file d'évènements, propriétés observées.
 *
 * Une seule instance à la fois — l'app ne lit qu'une chose. `init` sur une
 * instance vivante la détruit d'abord, ce qui rend l'appel idempotent du point
 * de vue de la page (le lecteur est remonté à chaque épisode).
 */

import koffi from "koffi";
import { FORMAT, mpvApi, mpvError } from "./mpvFfi";
import { oublierEtat } from "./mpvEtat";
import { lireAsync, oublierLectures } from "./mpvLecture";
import { drain, oublierCadence, type Sink } from "./mpvDrain";
export type { MpvEventPayload, PropertyChange } from "./mpvTypes";


let ctx: unknown = null;
let pump: ReturnType<typeof setInterval> | null = null;
let observedIds = new Map<number, string>();

export function isRunning(): boolean {
  return ctx !== null;
}

/** La poignée courante, pour `mpvArret.ts`. `null` si mpv ne tourne pas. */
export function poignee(): unknown {
  return ctx;
}

/** Abandonne la poignée sans rien détruire. Réservé à l'arrêt asynchrone. */
export function poserPoignee(valeur: unknown): void {
  ctx = valeur;
}

/**
 * Coupe la pompe et règle les commandes en vol, sans toucher à la poignée.
 *
 * La file d'évènements ne rendra plus rien : une commande laissée en suspens
 * retiendrait pour toujours l'appelant — et donc la poignée IPC qui l'attend,
 * ce qui vaut une commande native perdue à chaque changement d'épisode.
 */
export function nettoyerEtat(): void {
  if (pump !== null) clearInterval(pump);
  pump = null;
  observedIds = new Map();
  oublierCadence();
  oublierEtat();
  oublierLectures();
  for (const resolve of enVol.values()) resolve("instance mpv detruite");
  enVol.clear();
}

/**
 * Prévenu quand mpv annonce son arrêt.
 *
 * ⚠️ C'est le seul instant où libérer la poignée ne bloque pas — d'où ce
 * détour plutôt qu'un import direct, qui serait circulaire (`mpvArret` a besoin
 * de la poignée que ce module tient).
 */
let auShutdown: (() => void) | null = null;

export function poserAuShutdown(rappel: (() => void) | null): void {
  auShutdown = rappel;
}

/**
 * Lit une propriété sous forme de chaîne. `null` si absente.
 *
 * # Sur macOS, on DEMANDE — mais on n'attend pas
 *
 * ⚠️ `mpv_get_property_string` est synchrone et prend le verrou du cœur de mpv.
 * Pour une propriété qui dépend de la sortie vidéo — `video-params/*`,
 * `video-target-params/*`, tout ce que le panneau de diagnostic affiche — mpv
 * doit toucher sa NSWindow, donc passer par le thread principal. Appelée DEPUIS
 * ce thread, la lecture attend un thread qui l'attend : l'application se fige,
 * sans un pourcent de processeur ni un message d'erreur.
 *
 * Le piège est qu'il ne se referme pas tout de suite : tout fonctionne pendant
 * plusieurs minutes, et l'application meurt au générique — au moment où mpv
 * reconfigure sa sortie pendant qu'on l'interroge. C'est le défaut le plus cher
 * de la phase 1, rencontré deux fois.
 *
 * `mpv_get_property_async` répond par la file d'évènements, qu'on vide déjà :
 * on peut donc tout lire sans rien attendre. Voir `mpvLecture.ts`, qui garde le
 * souvenir des propriétés observées en REPLI quand mpv ne répond pas.
 */
export function getProperty(name: string): Promise<string | null> {
  if (!ctx) return Promise.resolve(null);
  if (process.platform === "darwin") return lireAsync(ctx, name);
  const ptr = mpvApi().getPropertyString(ctx, name) as unknown;
  if (!ptr) return Promise.resolve(null);
  const value = koffi.decode(ptr, "char", -1) as string;
  mpvApi().free(ptr);
  return Promise.resolve(value);
}

/**
 * Écrit une propriété. Rend le motif de l'échec, ou `null`.
 *
 * # Sur macOS, on n'écrit pas non plus depuis ce thread
 *
 * ⚠️ `mpv_set_property_string` est le JUMEAU de la lecture ci-dessus, et il a
 * coûté exactement aussi cher : elle prend `mp_dispatch_lock`, donc attend le
 * cœur de mpv — lequel attend le thread principal pour créer sa `NSWindow`.
 * Chacun attend l'autre, à zéro pourcent de processeur et sans une erreur.
 *
 * Le défaut se déclenchait à COUP SÛR, et avant même la première image : la page
 * restaure le volume dès que le lecteur est prêt (`useMpvLifecycle`), puis pose
 * `pause=false` en tête de `play()` — les deux partent avant `loadfile`. D'où le
 * symptôme constaté pendant toute la phase 2 : chargement perpétuel, aucun
 * évènement mpv, aucun rapport de plantage. Pile du thread principal relevée au
 * `sample`, sans ambiguïté possible :
 *
 *   com.apple.main-thread → mpv_set_property_string → mpv_set_property
 *                         → mp_dispatch_lock → _pthread_cond_wait
 *
 * `set` par la file de commandes fait rigoureusement la même chose — c'est la
 * porte que `mpv_set_property_string` emprunte elle-même — mais sans attendre.
 *
 * Windows garde l'appel direct : sa fenêtre vidéo est une fenêtre enfant Win32
 * sans couplage au thread principal, et rien n'y a jamais bloqué.
 */
export function setProperty(name: string, value: string): Promise<string | null> {
  if (!ctx) return Promise.resolve("mpv n'est pas demarre");
  if (process.platform !== "darwin") {
    return Promise.resolve(mpvError(mpvApi().setPropertyString(ctx, name, value) as number));
  }
  return command(["set", name, value]);
}

/** Exécute une commande mpv. Les arguments passent en tableau, jamais
 *  concaténés : un chemin de fichier contient des espaces et des guillemets. */
/**
 * Commandes en vol : identifiant de réponse → résolution de la promesse.
 *
 * Base haute et volontairement distincte des identifiants de propriétés
 * observées (`index + 1`, donc quelques unités) : les deux familles partagent
 * le champ `reply_userdata` des évènements, et les confondre à la lecture d'un
 * journal coûterait cher.
 */
const COMMANDE_ID_BASE = 1_000_000;
const enVol = new Map<number, (err: string | null) => void>();
let prochaineCommande = COMMANDE_ID_BASE;

/**
 * Exécute une commande mpv SANS bloquer le processus principal.
 *
 * ⚠️ C'est la raison d'être de cette fonction. `mpv_command` ne rend la main
 * qu'une fois la commande terminée, et l'appel FFI est synchrone sur le thread
 * du processus principal : un `sub-add` vers une URL injoignable y restait le
 * temps du `network-timeout` — trente secondes, multipliées par les
 * reconnexions. Pendant tout ce temps l'application entière était gelée, plus
 * un clic ne passait, et la lecture continuait imperturbablement puisque mpv
 * vit sur ses propres threads. Symptôme constaté, journal à l'appui.
 *
 * `mpv_command_async` part et rend la main ; le résultat arrive en
 * `COMMAND_REPLY`, que la boucle d'évènements récupère déjà.
 *
 * Les arguments passent en tableau, jamais concaténés : un chemin de fichier
 * contient des espaces et des guillemets.
 */
export function command(args: readonly string[]): Promise<string | null> {
  if (!ctx) return Promise.resolve("mpv n'est pas demarre");

  const id = prochaineCommande;
  prochaineCommande += 1;
  return new Promise<string | null>((resolve) => {
    enVol.set(id, resolve);
    const envoi = mpvError(mpvApi().commandAsync(ctx, id, [...args, null]) as number);
    // Refus à l'ENVOI (arguments invalides, file pleine) : aucune réponse ne
    // viendra jamais, la promesse ne doit pas rester en suspens.
    if (envoi !== null) {
      enVol.delete(id);
      resolve(envoi);
    }
  });
}

/** Règle une commande en vol. Un identifiant inconnu est ignoré sans bruit. */
function repondre(id: number, code: number): void {
  const resolve = enVol.get(id);
  if (resolve === undefined) return;
  enVol.delete(id);
  resolve(mpvError(code));
}



export interface InitOptions {
  /** Options passées à mpv AVANT `mpv_initialize`, verbatim. */
  options: Readonly<Record<string, string | number | boolean>>;
  /** Propriétés à observer : `[nom, format]`, format au sens de la page. */
  observed: ReadonlyArray<readonly [string, string]>;
  /** Descripteur de la fenêtre hôte, pour l'embarquement `--wid`. */
  wid: bigint;
}

const FORMAT_BY_NAME: Readonly<Record<string, number>> = {
  flag: FORMAT.FLAG,
  int64: FORMAT.INT64,
  double: FORMAT.DOUBLE,
  string: FORMAT.STRING,
  none: FORMAT.NONE,
};

/** Démarre mpv. Détruit l'instance précédente s'il y en a une. */
export function init(opts: InitOptions, sink: Sink): string | null {
  destroy();

  const handle = mpvApi().create() as unknown;
  if (!handle) return "mpv_create a echoue";
  ctx = handle;

  for (const [k, v] of Object.entries(opts.options)) {
    // Une option inconnue du libmpv embarqué n'est jamais fatale : mpv la
    // signale et continue. On ne remonte donc pas ces erreurs.
    mpvApi().setOptionString(ctx, k, typeof v === "boolean" ? (v ? "yes" : "no") : String(v));
  }
  // ⚠️ `wid` est POSÉ SOUS WINDOWS UNIQUEMENT, et l'omettre ailleurs n'est pas
  // un détail : c'est la différence entre une lecture et une application figée.
  //
  // Sur macOS, le backend qui lisait `--wid` était le backend OpenGL cocoa,
  // déprécié en mpv 0.29 et RETIRÉ en 0.37. Le backend actuel ne consulte plus
  // cet identifiant — mais le lui fournir le fait tout de même tenter de
  // s'accrocher à la NSView qu'on lui désigne, sur le thread principal, celui-là
  // même dont il a besoin pour finir. L'application se fige alors au lancement
  // d'une vidéo : chargement perpétuel, plus une interaction.
  //
  // mpv crée donc sa PROPRE fenêtre, qu'on attache ensuite sous la nôtre — voir
  // `macosSurface.ts`. C'est même ce qu'on veut : c'est cette fenêtre qui porte
  // la couche Metal, donc tout le HDR.
  if (process.platform === "win32") {
    mpvApi().setOptionString(ctx, "wid", String(opts.wid));
  }

  const err = mpvError(mpvApi().initialize(ctx) as number);
  if (err) {
    destroy();
    return `mpv_initialize : ${err}`;
  }

  observedIds = new Map();
  opts.observed.forEach(([name, format], index) => {
    const id = index + 1;
    observedIds.set(id, name);
    mpvApi().observeProperty(ctx, id, name, FORMAT_BY_NAME[format] ?? FORMAT.STRING);
  });

  // 20 ms : assez fin pour que la file ne déborde jamais — libmpv se bloque
  // quand elle est pleine, c'est documenté et ça gèlerait la lecture.
  pump = setInterval(() => drain(ctx, sink, { repondre, auShutdown: () => {
    if (auShutdown !== null) auShutdown();
  } }), 20);
  return null;
}

/**
 * Arrêt de secours, immédiat.
 *
 * ⚠️ Sur macOS, `terminateDestroy` FIGE le processus : elle attend le démontage
 * de la sortie vidéo, qui réclame le thread principal — celui-là même qui
 * appelle. Le chemin normal y passe donc par `mpvArret.ts`, qui démonte la
 * vidéo d'abord. Cette fonction reste la sortie de secours : elle sert quand
 * `mpv_initialize` a échoué, cas où aucune sortie vidéo n'existe encore et où
 * `mpv_destroy` rend donc la main sans attendre personne.
 */
export function destroy(): void {
  if (pump !== null) clearInterval(pump);
  pump = null;
  if (ctx) {
    if (process.platform === "darwin") mpvApi().destroyClient(ctx);
    else mpvApi().terminateDestroy(ctx);
  }
  ctx = null;
  observedIds = new Map();
  oublierCadence();
  oublierEtat();
  oublierLectures();

  // La file d'évènements vient de mourir : plus aucune réponse n'arrivera. Une
  // commande laissée en suspens retiendrait pour toujours l'appelant — et donc
  // la poignée IPC qui l'attend, ce qui vaut une commande native perdue à
  // chaque changement d'épisode.
  for (const resolve of enVol.values()) resolve("instance mpv detruite");
  enVol.clear();
}
