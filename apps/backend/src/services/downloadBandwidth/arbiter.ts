/**
 * L'arbitre de débit des téléchargements.
 *
 * Deux pools — réseau local, extérieur —, chacun sous son plafond (ou sans).
 * À chaque tick (100 ms), l'arbitre relit les plafonds (un réglage change à
 * chaud), découpe le budget du tick entre les comptes actifs puis entre leurs
 * transferts (`allocate`), et réveille les flux servis. Un flux qui n'a pas
 * vidé son accord demande à peine plus la fois suivante ; un flux à sec
 * demande « l'infini » : c'est ainsi que la part d'un compte lent revient aux
 * autres sans que personne ne mesure quoi que ce soit.
 *
 * Accord par tick plutôt que permis par bloc : un flux puise ses blocs
 * (≤ 64 Kio) dans son accord sans repasser par l'arbitre, ce qui tient
 * 20 Mio/s sur un seul flux comme 64 Kio/s sur trois — et garantit des blocs
 * FRÉQUENTS même sous un plafond bas (iOS coupe un transfert muet ~60 s).
 * Sans plafond, `take` rend tout, tout de suite : coût nul.
 *
 * Le minuteur n'est armé qu'avec au moins un flux, et ne retient jamais le
 * processus. Mono-instance Docker : l'état vit en mémoire.
 */

import { allocate, type UserDemand } from "./allocation";
import type { BandwidthCaps, PoolId } from "./caps";

export const TICK_MS = 100;
/** Taille maximale d'un bloc poussé à l'aval. */
export const MAX_BLOCK = 64 * 1024;
/** Le premier bloc part sans attendre un tick. */
const FIRST_GRANT = MAX_BLOCK;
/** Un flux qui n'a pas vidé son accord peut accélérer un peu au tick suivant. */
const HEADROOM = 1.25;
/** Plancher de demande : un flux dont l'amont s'est tu repart avec ça, se
 *  retrouve à sec, et demande alors sa vraie part. */
const MIN_DEMAND = 8 * 1024;
const POOLS: readonly PoolId[] = ["internal", "external"];

export interface FlowHandle {
  /** Octets accordés tout de suite (≤ n) ; 0 = à sec, attendre `next()`. */
  take(n: number): number;
  /** Tenue jusqu'au prochain tick qui accorde des octets ; rejetée si le flux est libéré. */
  next(): Promise<void>;
  /** Rend la part aux autres. Idempotent : fin, erreur et destruction peuvent se croiser. */
  release(): void;
}

interface Waiter {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

interface Flow {
  id: number;
  userId: string;
  pool: PoolId;
  unlimited: boolean;
  /** Reste accordé pour le tick en cours. */
  grant: number;
  /** Pris depuis le dernier tick — l'estimation de la demande. */
  used: number;
  /** A demandé alors que l'accord était vide : demande « infinie » au tick. */
  starved: boolean;
  waiter: Waiter | null;
  released: boolean;
}

export interface ArbiterOptions {
  now?: () => number;
  tickMs?: number;
}

export type PoolSnapshot = Record<PoolId, { users: number; flows: number }>;

export class BandwidthArbiter {
  private readonly flows = new Map<number, Flow>();
  private nextId = 1;
  private timer: NodeJS.Timeout | null = null;
  private lastTickAt: number | null = null;
  private readonly now: () => number;
  private readonly tickMs: number;

  constructor(
    private readonly readCaps: () => BandwidthCaps,
    options: ArbiterOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.tickMs = options.tickMs ?? TICK_MS;
  }

  register(userId: string, pool: PoolId): FlowHandle {
    const flow: Flow = {
      id: this.nextId++,
      userId,
      pool,
      unlimited: this.readCaps()[pool] === null,
      grant: FIRST_GRANT,
      used: 0,
      starved: false,
      waiter: null,
      released: false,
    };
    this.flows.set(flow.id, flow);
    if (this.timer === null) {
      this.lastTickAt = this.now();
      this.timer = setInterval(() => this.tick(), this.tickMs);
      this.timer.unref();
    }
    return {
      take: (n) => this.take(flow, n),
      next: () => this.next(flow),
      release: () => this.release(flow),
    };
  }

  /** Un tick : relit les plafonds, réalloue chaque pool, réveille les flux servis. */
  tick(): void {
    const now = this.now();
    const since = this.lastTickAt === null ? this.tickMs : now - this.lastTickAt;
    // Borné à deux ticks : un processus qui a dormi ne libère pas une rafale.
    const elapsed = Math.max(0, Math.min(since, 2 * this.tickMs));
    this.lastTickAt = now;
    const caps = this.readCaps();
    for (const pool of POOLS) {
      const flows = [...this.flows.values()].filter((flow) => flow.pool === pool);
      if (flows.length === 0) continue;
      const cap = caps[pool];
      if (cap === null) {
        for (const flow of flows) {
          flow.unlimited = true;
          flow.used = 0;
          flow.starved = false;
          wake(flow);
        }
        continue;
      }
      const budget = Math.floor((cap * elapsed) / 1000);
      const byUser = new Map<string, UserDemand>();
      for (const flow of flows) {
        const demand = flow.starved ? Infinity : Math.max(MIN_DEMAND, Math.ceil(flow.used * HEADROOM));
        let user = byUser.get(flow.userId);
        if (!user) {
          user = { userId: flow.userId, flows: [] };
          byUser.set(flow.userId, user);
        }
        user.flows.push({ id: flow.id, demand });
      }
      const grants = allocate(budget, [...byUser.values()]);
      for (const flow of flows) {
        flow.unlimited = false;
        flow.grant = grants.get(flow.id) ?? 0;
        flow.used = 0;
        flow.starved = false;
        if (flow.grant > 0) wake(flow);
      }
    }
  }

  /** Comptes et flux par pool — pour les tests et une trace. */
  snapshot(): PoolSnapshot {
    const out: PoolSnapshot = { internal: { users: 0, flows: 0 }, external: { users: 0, flows: 0 } };
    const users: Record<PoolId, Set<string>> = { internal: new Set(), external: new Set() };
    for (const flow of this.flows.values()) {
      out[flow.pool].flows += 1;
      users[flow.pool].add(flow.userId);
    }
    for (const pool of POOLS) out[pool].users = users[pool].size;
    return out;
  }

  private take(flow: Flow, n: number): number {
    if (flow.released || n <= 0) return 0;
    if (flow.unlimited) {
      flow.used += n;
      return n;
    }
    const granted = Math.min(n, flow.grant, MAX_BLOCK);
    if (granted <= 0) {
      flow.starved = true;
      return 0;
    }
    flow.grant -= granted;
    flow.used += granted;
    return granted;
  }

  private next(flow: Flow): Promise<void> {
    if (flow.released) return Promise.reject(new Error("flow released"));
    if (flow.unlimited || flow.grant > 0) return Promise.resolve();
    if (flow.waiter === null) {
      let resolve = () => {};
      let reject = (_error: Error) => {};
      const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      flow.waiter = { promise, resolve, reject };
    }
    return flow.waiter.promise;
  }

  private release(flow: Flow): void {
    if (flow.released) return;
    flow.released = true;
    this.flows.delete(flow.id);
    const waiter = flow.waiter;
    flow.waiter = null;
    waiter?.reject(new Error("flow released"));
    if (this.flows.size === 0 && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      this.lastTickAt = null;
    }
  }
}

function wake(flow: Flow): void {
  const waiter = flow.waiter;
  if (waiter === null) return;
  flow.waiter = null;
  waiter.resolve();
}
