import { credit, TICK_MS } from "./credit";
import { takeLease, releaseLease, ME } from "./lease";
import { readSessions, normalize } from "./sessions";
import { adoptOrCreate, sweepOrphans, writeSegments, closeSegments } from "./store";
import type { SessionState } from "./types";

/**
 * Collecteur de temps de visionnage — la boucle.
 *
 * Un relevé toutes les 15 s, plus un relevé immédiat quand le WebSocket
 * Jellyfin signale un début ou une fin de lecture : cela supprime l'erreur en
 * tête et en queue de segment, qui vaudrait sinon jusqu'à un tick de chaque
 * côté.
 *
 * Le collecteur ne se met JAMAIS en veille, contrairement au poller
 * (`jellyfinPoller.ts`, qui s'arrête dès que le WebSocket est debout) : il est
 * la source de mesure, il ne peut pas dépendre de la bonne santé d'un canal
 * qu'il ne contrôle pas.
 */

/** Le balayage des orphelins est rare : il ne rattrape que les arrêts brutaux. */
const SWEEP_MS = 5 * 60_000;

/** Anti-rebond des réveils : trois signaux d'affilée ne font qu'un relevé. */
const DEBOUNCE_MS = 3_000;

let timer: NodeJS.Timeout | null = null;
let sweepTimer: NodeJS.Timeout | null = null;
let running = false;
let lastPokeMs = 0;

let state = new Map<string, SessionState>();

/**
 * Photographie du dernier relevé, pour la route de diagnostic.
 *
 * ⚠️ Ces noms de champs SONT le corps de la réponse `GET /api/admin/watch-time`
 * : ils partent tels quels sur le fil. Ils restent donc en français, comme le
 * reste du contrat de cette route.
 */
export interface CollectorState {
  actif: boolean;
  instance: string;
  bail: boolean;
  dernierTick: string | null;
  sessionsVues: number;
  segments: { user: string; item: string; secondes: number; vivant: boolean }[];
}

let lastTick: string | null = null;
let seenSessions = 0;
let leaseHeld = false;

export function collectorState(): CollectorState {
  return {
    actif: timer !== null,
    instance: ME,
    bail: leaseHeld,
    dernierTick: lastTick,
    sessionsVues: seenSessions,
    segments: [...state.values()].map((s) => ({
      user: s.userId,
      item: s.sample.itemName || s.itemId,
      secondes: Math.round(s.seconds),
      vivant: s.alive,
    })),
  };
}

/** Un relevé complet. Jamais réentrant : un relevé lent ne se chevauche pas. */
async function poll(): Promise<void> {
  if (running) return;
  running = true;
  try {
    leaseHeld = await takeLease();
    if (!leaseHeld) {
      // Une autre instance mesure. On oublie tout : au retour du bail, le
      // premier relevé repartira froid, sans créditer l'intervalle aveugle.
      state = new Map();
      return;
    }

    const raw = await readSessions();
    if (!raw) return; // Jellyfin muet : on ne crédite rien, on ne touche à rien.

    const clockMs = Date.now();
    const samples = normalize(raw, clockMs);
    seenSessions = samples.length;

    const tally = credit(state, samples, performance.now(), clockMs);
    state = tally.state;
    lastTick = new Date(clockMs).toISOString();

    // Les lignes ne sont créées qu'au premier crédit : une session qui n'a
    // jamais rien accumulé ne laisse pas de trace.
    for (const s of tally.toWrite) await adoptOrCreate(s);
    await writeSegments(tally.toWrite);
    await closeSegments(tally.toClose.filter((s) => s.segmentId));
  } catch {
    // Un relevé raté est sans conséquence : l'état vit en mémoire et l'écriture
    // est absolue, le suivant réécrira le bon total.
  } finally {
    running = false;
  }
}

/** Réveil provoqué par le WebSocket Jellyfin (début / progression / fin). */
export function pokeWatchTime(): void {
  if (!timer) return;
  const now = Date.now();
  if (now - lastPokeMs < DEBOUNCE_MS) return;
  lastPokeMs = now;
  void poll();
}

export function startWatchTime(): void {
  if (timer) return;
  timer = setInterval(() => void poll(), TICK_MS);
  // Le premier relevé est différé : il ne servirait qu'à poser des lignes de
  // base, et le balayage doit passer APRÈS la fenêtre de reprise pour ne pas
  // fermer les segments que ce relevé va réadopter.
  setTimeout(() => void poll(), 5_000);
  sweepTimer = setInterval(() => void sweepOrphans(), SWEEP_MS);
  console.log("[WatchTime] collecteur démarré (relevé toutes les 15 s)");
}

export async function stopWatchTime(): Promise<void> {
  if (timer) clearInterval(timer);
  if (sweepTimer) clearInterval(sweepTimer);
  timer = null;
  sweepTimer = null;
  // Dernière écriture : les segments en cours gardent le temps déjà mesuré, et
  // restent OUVERTS — un redémarrage les réadoptera au lieu d'en créer d'autres.
  const open = [...state.values()].filter((s) => s.segmentId);
  await writeSegments(open);
  await releaseLease();
}
