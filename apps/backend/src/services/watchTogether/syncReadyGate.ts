import type { SegmentType } from "../../playback/segmentTypes";
import { isMemberOnline } from "./memberDevices";
import type { Room } from "./roomTypes";
import { visibleArrivals } from "./arrivalState";

/**
 * Watch Together — « tous prêts » (1.31.1, `watchTogether.readyGate`).
 *
 * Le bug : une vidéo qui commence par une intro montrait « Passer l'intro »
 * avant que tous les membres soient arrivés — le premier posé sautait seul,
 * les autres atterrissaient après le saut, sans avoir rien décidé. Désormais,
 * à chaque titre lancé, la salle retient les membres qu'elle ATTEND (tous ceux
 * en ligne au premier lancement : ils suivent tous ; ensuite, ceux qui
 * regardaient et le lanceur) ; tant qu'ils ne sont pas tous posés — en
 * lecture déclarée, plus en chargement, plus attendus par une barrière — aucun
 * saut de passage : `allReady` faux dans l'état, `wt:skipPropose` mis de côté
 * (et rejoué à l'ouverture). Une fois ouverte, la porte le reste pour ce titre
 * (un membre qui quitte puis revient ne la referme pas) ; une barrière en
 * cours, elle, suspend `allReady` le temps de se lever.
 *
 * Un attendu hors ligne, parti ou incapable de lire ne compte plus. Au bout
 * de WT_READY_GATE_TIMEOUT_MS, la porte s'ouvre quand même : un membre resté
 * sur l'accueil ne prive pas la salle de ses sauts.
 */

export const WT_READY_GATE_TIMEOUT_MS = 60_000;

/** Une proposition de saut arrivée avant « tous prêts », rejouée à l'ouverture. */
export interface DeferredSkip {
  userId: string;
  proposal: { segmentType: SegmentType; isEpisode: boolean; segmentStartTicks: number; toTicks: number };
}

export interface ReadyGate {
  itemId: string;
  /** Les membres attendus pour ce titre. */
  expected: Set<string>;
  openedAt: number;
  /** Ouverte (verrouillée) : tous ont été prêts une fois, ou le délai est passé. */
  open: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  deferred: DeferredSkip | null;
}

let openedHandler: ((room: Room) => void) | null = null;

/** Le gateway s'inscrit ici : la porte ouverte par le délai, c'est lui qui diffuse. */
export function onReadyGateOpened(handler: (room: Room) => void): void {
  openedHandler = handler;
}

function clearTimer(gate: ReadyGate): void {
  if (gate.timer) clearTimeout(gate.timer);
  gate.timer = null;
}

/** Un titre est lancé pour la salle : la porte se referme sur ces attendus. */
export function armReadyGate(room: Room, itemId: string, expected: Iterable<string>, now: number): void {
  if (room.readyGate) clearTimer(room.readyGate);
  const gate: ReadyGate = { itemId, expected: new Set(expected), openedAt: now, open: false, timer: null, deferred: null };
  gate.timer = setTimeout(() => {
    gate.timer = null;
    if (room.readyGate !== gate || gate.open) return;
    gate.open = true;
    openedHandler?.(room);
  }, WT_READY_GATE_TIMEOUT_MS);
  room.readyGate = gate;
}

/** Dissolution : plus de porte, plus de minuterie. */
export function dropReadyGate(room: Room): void {
  if (room.readyGate) clearTimer(room.readyGate);
  room.readyGate = null;
}

/** Tous les attendus sont-ils posés ? Verrouille la porte quand c'est le cas. */
export function isReadyGateOpen(room: Room, now: number = Date.now()): boolean {
  const gate = room.readyGate;
  if (!gate || gate.itemId !== room.itemId) return false;
  if (gate.open) return true;
  if (now - gate.openedAt >= WT_READY_GATE_TIMEOUT_MS) {
    gate.open = true;
  } else {
    for (const userId of gate.expected) {
      const member = room.members.get(userId);
      // Parti, hors ligne, incapable de lire : on ne l'attend plus.
      if (!member || member.playbackError || !isMemberOnline(member)) continue;
      if (!member.inPlayback || member.buffering || room.waitingFor.has(userId)) return false;
    }
    gate.open = true;
  }
  clearTimer(gate);
  return true;
}

/** Ce membre démarre-t-il le titre avec les autres (attendu par la porte, pas
 *  encore ouverte) ? Il n'« arrive » pas : il était là au lancement. */
export function isStartingMember(room: Room, userId: string, now: number = Date.now()): boolean {
  const gate = room.readyGate;
  return !!gate && gate.expected.has(userId) && !isReadyGateOpen(room, now);
}

/** `allReady` de l'état : la porte ouverte, aucune barrière en cours, et personne
 *  qui ARRIVE (du clic « Rejoindre » à son premier « prêt » — ajout de Damien du
 *  20/10 : aucun passage sauté tant que les membres ne sont pas dedans). */
export function wtAllReady(room: Room, now: number = Date.now()): boolean {
  return !!room.itemId && room.barrier === null && visibleArrivals(room).length === 0 && isReadyGateOpen(room, now);
}

/** Met de côté une proposition de saut arrivée trop tôt (la plus récente gagne). */
export function deferSkip(room: Room, deferred: DeferredSkip): void {
  if (room.readyGate) room.readyGate.deferred = deferred;
}

/** La proposition mise de côté, si la salle est désormais « tous prêts ». */
export function takeDeferredSkip(room: Room, now: number = Date.now()): DeferredSkip | null {
  const gate = room.readyGate;
  if (!gate?.deferred || !wtAllReady(room, now)) return null;
  const deferred = gate.deferred;
  gate.deferred = null;
  return deferred;
}
