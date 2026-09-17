/**
 * Instance mpv : cycle de vie, file d'évènements, propriétés observées.
 *
 * Une seule instance à la fois — l'app ne lit qu'une chose. `init` sur une
 * instance vivante la détruit d'abord, ce qui rend l'appel idempotent du point
 * de vue de la page (le lecteur est remonté à chaque épisode).
 */

import { app } from "electron";
import { FORMAT, mpvApi, mpvError } from "./mpvFfi";
import { setNumericLocaleC } from "./cLocale";
import { forgetState } from "./mpvState";
import { forgetLayer } from "./metalLayer";
import { forgetOutput } from "../linux/hdr";
import { forgetReads } from "./mpvRead";
import { readProperty, writeProperty } from "./mpvProperties";
import { sendCommand, settleAllCommands, settleCommand } from "./mpvCommand";
import { drain, forgetCadence, type Sink } from "./mpvDrain";
import { applyOptions } from "./mpvOptions";
export type { MpvEventPayload, PropertyChange } from "./mpvTypes";


let ctx: unknown = null;
let pump: ReturnType<typeof setInterval> | null = null;
let observedIds = new Map<number, string>();
/**
 * Évènements `idle` reçus depuis le lancement — monotone, jamais remis à
 * zéro : `mpvShutdown.ts` relève la valeur avant `stop` et attend qu'elle
 * bouge. libmpv en émet un à sa naissance (`idle=yes`), qui ne compte donc pas.
 */
let idleEvents = 0;
/** mpv est-il à l'idle — aucun fichier, depuis le dernier `idle` reçu ? */
let idle = false;

export function idleCount(): number {
  return idleEvents;
}

export function isIdle(): boolean {
  return idle;
}

export function isRunning(): boolean {
  return ctx !== null;
}

/** La poignée courante, pour `mpvShutdown.ts`. `null` si mpv ne tourne pas. */
export function handle(): unknown {
  return ctx;
}

/** Abandonne la poignée sans rien détruire. Réservé à l'arrêt asynchrone. */
export function setHandle(value: unknown): void {
  ctx = value;
}

/**
 * Coupe la pompe et règle les commandes en vol, sans toucher à la poignée.
 *
 * La file d'évènements ne rendra plus rien : une commande laissée en suspens
 * retiendrait pour toujours l'appelant — et donc la poignée IPC qui l'attend,
 * ce qui vaut une commande native perdue à chaque changement d'épisode.
 */
export function clearState(): void {
  if (pump !== null) clearInterval(pump);
  pump = null;
  observedIds = new Map();
  forgetCadence();
  forgetState();
  forgetLayer();
  forgetOutput();
  forgetReads();
  settleAllCommands("instance mpv detruite");
}

/**
 * Prévenu quand mpv annonce son arrêt.
 *
 * ⚠️ C'est le seul instant où libérer la poignée ne bloque pas — d'où ce
 * détour plutôt qu'un import direct, qui serait circulaire (`mpvShutdown` a besoin
 * de la poignée que ce module tient).
 */
let onShutdown: (() => void) | null = null;

export function setOnShutdown(callback: (() => void) | null): void {
  onShutdown = callback;
}

/** Lit une propriété sous forme de chaîne, `null` si absente — `mpvProperties.ts`. */
export function getProperty(name: string): Promise<string | null> {
  return readProperty(ctx, name);
}

/** Écrit une propriété ; rend le motif de l'échec, ou `null` — `mpvProperties.ts`. */
export function setProperty(name: string, value: string): Promise<string | null> {
  return writeProperty(ctx, name, value);
}

/** Exécute une commande SANS bloquer le processus principal — `mpvCommand.ts`. */
export function command(args: readonly string[]): Promise<string | null> {
  return sendCommand(ctx, args);
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

  // ⚠️ AVANT `mpv_create`, et à chaque lecture : sous Linux, GTK peut avoir
  // basculé `LC_NUMERIC` sur la locale du système entre-temps, et libmpv y lit
  // `0.5` comme `0`. Voir `cLocale.ts` — sans objet ailleurs.
  const localeBefore = setNumericLocaleC();
  if (localeBefore !== null && localeBefore !== "C") {
    console.info(`[mpv] LC_NUMERIC ramené de ${localeBefore} à C`);
  }

  const handle = mpvApi().create() as unknown;
  if (!handle) return "mpv_create a echoue";
  ctx = handle;
  idle = false;

  // Les options de la page, puis un socle non négociable : sans lui, mpv charge
  // sept scripts Lua, LuaJIT écrit du code machine, et la signature durcie du
  // paquet Mac App Store fait TUER le processus — voir `mpvOptions.ts`.
  applyOptions(ctx, opts.options);
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

  // ⚠️ La preuve du HDR sur macOS passe par le journal de mpv, et par nulle
  // part ailleurs : c'est lui qui dit si sa couche Metal est réellement passée
  // en PQ. Une propriété ne dit que ce que mpv CALCULE. Verbeux, mais `drain`
  // ne retient que ce qui parle de couleur — voir `JOURNAL_RETENU`.
  //
  // Développement seulement : dans un paquet livré, ces messages ne servent
  // personne et le décodage de chacun coûte un aller-retour FFI.
  if (process.platform === "darwin" && !app.isPackaged) {
    mpvApi().requestLogMessages(ctx, "v");
  }

  observe(ctx, opts.observed);

  // 20 ms : assez fin pour que la file ne déborde jamais — libmpv se bloque
  // quand elle est pleine, c'est documenté et ça gèlerait la lecture.
  pump = setInterval(() => drain(ctx, sink, {
    settle: settleCommand,
    onIdle: () => {
      idleEvents += 1;
      idle = true;
    },
    onStartFile: () => {
      idle = false;
    },
    onShutdown: () => {
      if (onShutdown !== null) onShutdown();
    },
  }), 20);
  return null;
}

function observe(handle: unknown, observed: InitOptions["observed"]): void {
  observedIds = new Map();
  observed.forEach(([name, format], index) => {
    const id = index + 1;
    observedIds.set(id, name);
    mpvApi().observeProperty(handle, id, name, FORMAT_BY_NAME[format] ?? FORMAT.STRING);
  });
}

/**
 * Ré-observe une instance gardée au chaud (`mpvPark.ts`) : les observations
 * sont retirées puis reposées, et mpv rejoue la valeur initiale de chaque
 * propriété — la page qui vient de se remonter les attend, exactement comme
 * d'une instance neuve.
 */
export function reobserve(observed: InitOptions["observed"]): void {
  if (!ctx) return;
  for (const id of observedIds.keys()) mpvApi().unobserveProperty(ctx, id);
  forgetState();
  observe(ctx, observed);
}

/**
 * Arrêt d'un bloc : chemin NORMAL de Windows, secours partout ailleurs.
 *
 * ⚠️ Sur macOS, `terminateDestroy` FIGE le processus : elle attend le démontage
 * de la sortie vidéo, qui réclame le thread principal — celui-là même qui
 * appelle. Sous Linux elle rend la main, mais après ~1 s de gel, fenêtre mpv
 * orpheline à l'écran comprise. Le chemin normal de ces deux plateformes passe
 * donc par `mpvShutdown.ts`, qui démonte la vidéo d'abord. Cette fonction
 * reste leur sortie de secours : elle sert quand `mpv_initialize` a échoué,
 * cas où aucune sortie vidéo n'existe encore et où la destruction rend la
 * main sans attendre personne.
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
  forgetCadence();
  forgetState();
  forgetLayer();
  forgetOutput();
  forgetReads();

  // La file d'évènements vient de mourir : plus aucune réponse n'arrivera.
  settleAllCommands("instance mpv detruite");
}
