/**
 * La file d'évènements de mpv : la vider, la décoder, la diffuser.
 *
 * C'est le seul canal par lequel mpv nous parle. Rien ici n'INTERROGE mpv : on
 * écoute, ce qui évite tout appel synchrone depuis le thread principal — voir
 * `mpvState.ts` pour ce que celui-ci coûte sur macOS.
 *
 * Séparé de `mpv.ts` pour tenir la limite de 300 lignes par fichier, et parce
 * que vider une file et gérer un cycle de vie sont deux métiers distincts.
 */

import koffi from "koffi";
import {
  EVENT,
  EVENT_NAMES,
  FORMAT,
  MpvEvent,
  MpvEventEndFile,
  MpvEventLogMessage,
  MpvEventProperty,
  mpvApi,
} from "./mpvFfi";
import { remember } from "./mpvState";
import { rememberLog } from "./metalLayer";
import { settleRead } from "./mpvRead";
import type { MpvEventPayload, PropertyChange } from "./mpvTypes";

/** Ce que la vidange doit pouvoir faire remonter à `mpv.ts`. */
export interface Hooks {
  /** Règle une commande asynchrone qui vient d'aboutir. */
  settle: (id: number, code: number) => void;
  /** mpv annonce son arrêt — le seul instant où libérer ne bloque pas. */
  onShutdown: () => void;
}

export interface Sink {
  event: (payload: MpvEventPayload) => void;
  property: (payload: PropertyChange) => void;
}

/**
 * `time-pos` est émis à la cadence des images — 24 fois par seconde sur un
 * film, davantage sur un flux à 60. Le traverser tel quel noierait le pont IPC
 * et ferait rendre React à chaque image pour déplacer une barre de progression
 * de moins d'un pixel. On l'étrangle à 8 Hz, ce qui reste fluide à l'œil.
 */
const TIME_POS_INTERVAL_MS = 125;
let lastTimePos = 0;

/** Repart de zéro entre deux instances. */
export function forgetCadence(): void {
  lastTimePos = 0;
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
const MAX_PER_PASS = 128;

/**
 * Ce qu'on retient des messages de journal de mpv.
 *
 * ⚠️ La preuve du HDR sur macOS passe par LÀ, et par nulle part ailleurs : mpv
 * trace lui-même l'état de sa couche Metal — « Metal layer colorspace changed:
 * ITUR_2100_PQ », puis « Metal layer HDR active ». C'est le rendu qui parle, pas
 * une sonde extérieure qui devine. Aucune propriété ne dit la même chose : mpv
 * annonce une sortie `pq` dès qu'il la CALCULE, bien avant de savoir si l'écran
 * l'a acceptée.
 *
 * Filtré, parce que le niveau verbeux de mpv produit des centaines de lignes par
 * seconde et noierait tout le reste du journal.
 */
const LOG_KEPT = /colorspace|hdr|edr|metal layer|dolby|dovi|reconfig to/i;

/**
 * Le bruit qui passe le filtre sans rien apprendre.
 *
 * ffmpeg répète « Multiple Dolby Vision RPUs found in one AU » à CHAQUE unité
 * d'accès sur un flux profil 8.1 — des dizaines de lignes par seconde, qui
 * noyaient les deux seules qui comptent (`ITUR_2100_PQ`, `HDR active`).
 */
const LOG_NOISE = /Multiple Dolby Vision RPUs/i;

/** Relaie ce que mpv dit de sa couche Metal. Développement seulement. */
function logLine(data: unknown): void {
  const m = koffi.decode(data, MpvEventLogMessage) as { prefix: string; text: string };
  if (!LOG_KEPT.test(m.text) || LOG_NOISE.test(m.text)) return;
  // Retenu AVANT d'être tracé : c'est de là que vient la seule réponse fiable à
  // « la couche est-elle en plage étendue ? » — voir `metalLayer.ts`.
  rememberLog(m.text);
  console.info(`[mpv:${m.prefix}] ${m.text.trimEnd()}`);
}

/** Vide la file d'évènements et diffuse. */
export function drain(ctx: unknown, sink: Sink, hooks: Hooks): void {
  if (!ctx) return;
  for (let n = 0; n < MAX_PER_PASS; n += 1) {
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

    if (id === EVENT.LOG_MESSAGE) {
      if (ev.data) logLine(ev.data);
      continue;
    }

    // Une commande asynchrone vient d'aboutir : on règle sa promesse et on
    // n'en dit rien à la page — c'est l'appelant qui saura quoi en faire.
    if (id === EVENT.COMMAND_REPLY) {
      hooks.settle(Number(ev.reply_userdata), ev.error);
      continue;
    }

    // Réponse à une lecture asynchrone. Même charge utile qu'un changement de
    // propriété, mais elle ne concerne QUE celui qui l'a demandée : rien n'en
    // est retenu ni diffusé à la page.
    if (id === EVENT.GET_PROPERTY_REPLY) {
      const p = ev.data
        ? (koffi.decode(ev.data, MpvEventProperty) as { format: number; data: unknown })
        : null;
      settleRead(
        Number(ev.reply_userdata),
        ev.error,
        p === null ? null : decodeProperty(p.format, p.data),
      );
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
      const value = decodeProperty(p.format, p.data);
      // Retenu AVANT diffusion : c'est ce souvenir que `getProperty` sert sur
      // macOS, où interroger mpv depuis ce thread fige l'application.
      remember(p.name, value);
      sink.property({
        name: p.name,
        data: value,
        id: Number(ev.reply_userdata),
      });
      continue;
    }

    if (id === EVENT.END_FILE && ev.data) {
      const end = koffi.decode(ev.data, MpvEventEndFile) as { reason: number; error: number };
      sink.event({ event: "end-file", reason: end.reason, error: end.error });
      continue;
    }

    const name = EVENT_NAMES[id];
    if (name) sink.event({ event: name });

    // mpv annonce son arrêt : c'est le seul instant où libérer la poignée ne
    // bloque pas. On rend la main immédiatement, la file n'a plus rien à dire.
    if (id === EVENT.SHUTDOWN) {
      hooks.onShutdown();
      return;
    }
  }
}
