/**
 * Instance mpv : cycle de vie, file d'évènements, propriétés observées.
 *
 * Une seule instance à la fois — l'app ne lit qu'une chose. `init` sur une
 * instance vivante la détruit d'abord, ce qui rend l'appel idempotent du point
 * de vue de la page (le lecteur est remonté à chaque épisode).
 */

import koffi from "koffi";
import {
  EVENT,
  EVENT_NAMES,
  FORMAT,
  MpvEvent,
  MpvEventEndFile,
  MpvEventProperty,
  mpvApi,
  mpvError,
} from "./mpvFfi";

/** Charge utile poussée vers la page. */
export interface PropertyChange {
  name: string;
  data: unknown;
  id: number;
}
export interface MpvEventPayload {
  event: string;
  [key: string]: unknown;
}

type Sink = {
  event: (payload: MpvEventPayload) => void;
  property: (payload: PropertyChange) => void;
};

/**
 * `time-pos` est émis à la cadence des images — 24 fois par seconde sur un
 * film, davantage sur un flux à 60. Le traverser tel quel noierait le pont IPC
 * et ferait rendre React à chaque image pour déplacer une barre de progression
 * de moins d'un pixel. On l'étrangle à 8 Hz, ce qui reste fluide à l'œil.
 */
const TIME_POS_INTERVAL_MS = 125;

let ctx: unknown = null;
let pump: ReturnType<typeof setInterval> | null = null;
let lastTimePos = 0;
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
  lastTimePos = 0;
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

/** Lit une propriété sous forme de chaîne. `null` si absente. */
export function getProperty(name: string): string | null {
  if (!ctx) return null;
  const ptr = mpvApi().getPropertyString(ctx, name) as unknown;
  if (!ptr) return null;
  const value = koffi.decode(ptr, "char", -1) as string;
  mpvApi().free(ptr);
  return value;
}

export function setProperty(name: string, value: string): string | null {
  if (!ctx) return "mpv n'est pas demarre";
  return mpvError(mpvApi().setPropertyString(ctx, name, value) as number);
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

/** Décode la valeur d'une propriété selon son format. */
function decodeProperty(format: number, data: unknown): unknown {
  if (!data || format === FORMAT.NONE) return null;
  if (format === FORMAT.FLAG) return (koffi.decode(data, "int") as number) !== 0;
  // Pas de `as bigint` ici : koffi rend un Number tant que la valeur tient dans
  // la plage sûre. `Number()` accepte les deux, donc c'était sans conséquence —
  // mais l'assertion était fausse, et la même a coûté un crash dans
  // `videoWindow.ts` (voir `bits()`).
  if (format === FORMAT.INT64) return Number(koffi.decode(data, "int64"));
  if (format === FORMAT.DOUBLE) return koffi.decode(data, "double") as number;
  if (format === FORMAT.STRING) {
    const ptr = koffi.decode(data, "void*") as unknown;
    return ptr ? (koffi.decode(ptr, "char", -1) as string) : null;
  }
  return null;
}

/**
 * Nombre maximal d'évènements traités par passage.
 *
 * ⚠️ Ce n'est pas une optimisation, c'est ce qui empêche le gel.
 *
 * Une boucle « vider jusqu'au bout » suppose que la file finit par se taire.
 * Elle ne se tait pas : avec les messages de journal actifs, mpv en produit plus
 * vite qu'on ne les consomme, et la boucle ne rend JAMAIS la main. Le thread
 * principal d'Electron est alors monopolisé — plus un minuteur, plus un
 * évènement de fenêtre. Symptôme : l'application semble vivante, mpv joue, et
 * le processus principal est mort. Constaté en phase 1.
 *
 * Ce qui reste sera pris au passage suivant, vingt millisecondes plus tard. mpv
 * tolère le retard : quand sa file déborde il émet `QUEUE_OVERFLOW` et jette
 * des messages de journal — jamais des évènements.
 */
const MAX_PAR_PASSAGE = 128;

/** Vide la file d'évènements et diffuse. */
function drain(sink: Sink): void {
  if (!ctx) return;
  for (let n = 0; n < MAX_PAR_PASSAGE; n += 1) {
    const ptr = mpvApi().waitEvent(ctx, 0) as unknown;
    if (!ptr) return;
    const ev = koffi.decode(ptr, MpvEvent) as {
      event_id: number;
      error: number;
      reply_userdata: bigint;
      data: unknown;
    };
    const id = ev.event_id;
    if (id === EVENT.NONE) return;

    // Une commande asynchrone vient d'aboutir : on règle sa promesse et on
    // n'en dit rien à la page — c'est l'appelant qui saura quoi en faire.
    if (id === EVENT.COMMAND_REPLY) {
      repondre(Number(ev.reply_userdata), ev.error);
      continue;
    }

    if (id === EVENT.PROPERTY_CHANGE) {
      if (!ev.data) continue;
      const p = koffi.decode(ev.data, MpvEventProperty) as {
        name: string;
        format: number;
        data: unknown;
      };
      // Étranglement : voir TIME_POS_INTERVAL_MS.
      if (p.name === "time-pos") {
        const now = Date.now();
        if (now - lastTimePos < TIME_POS_INTERVAL_MS) continue;
        lastTimePos = now;
      }
      sink.property({
        name: p.name,
        data: decodeProperty(p.format, p.data),
        id: Number(ev.reply_userdata),
      });
      continue;
    }

    if (id === EVENT.END_FILE && ev.data) {
      const end = koffi.decode(ev.data, MpvEventEndFile) as { reason: number; error: number };
      sink.event({ event: "end-file", reason: end.reason, error: end.error });
      continue;
    }

    const nom = EVENT_NAMES[id];
    if (nom) sink.event({ event: nom });

    // mpv annonce son arrêt : c'est le seul instant où libérer la poignée ne
    // bloque pas. On rend la main immédiatement, la file n'a plus rien à dire.
    if (id === EVENT.SHUTDOWN) {
      if (auShutdown !== null) auShutdown();
      return;
    }
  }
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
  mpvApi().setOptionString(ctx, "wid", String(opts.wid));

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
  pump = setInterval(() => drain(sink), 20);
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
  lastTimePos = 0;

  // La file d'évènements vient de mourir : plus aucune réponse n'arrivera. Une
  // commande laissée en suspens retiendrait pour toujours l'appelant — et donc
  // la poignée IPC qui l'attend, ce qui vaut une commande native perdue à
  // chaque changement d'épisode.
  for (const resolve of enVol.values()) resolve("instance mpv detruite");
  enVol.clear();
}
