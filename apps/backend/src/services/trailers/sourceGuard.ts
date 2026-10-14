/* ------------------------------------------------------------------ */
/*  Ménager une source de vidéos : disjoncteur, budgets, cadence        */
/*                                                                     */
/*  Le modèle de `youtubeGuard.ts`, rendu réutilisable pour chaque     */
/*  source (YouTube, Dailymotion) :                                    */
/*  - le DISJONCTEUR : la source refuse (vérification anti-robot,      */
/*    limite, erreurs répétées) → plus rien pendant 30 min, doublées à */
/*    chaque rechute jusqu'à 4 h, remises à zéro au premier succès ;   */
/*  - les BUDGETS : N appels par fenêtre glissante, pour le serveur ;  */
/*  - les SEAUX : quelques appels d'avance, puis un tous les X (par    */
/*    compte, ou pour tout le serveur — la cadence d'une API).         */
/*  Le temps est passé en argument : des tests à l'horloge factice.    */
/*  L'état se photographie (`snapshot`) et se reprend (`restore`) : il */
/*  survit au redémarrage (`guardState.ts`).                           */
/* ------------------------------------------------------------------ */

/** Pourquoi une source est en pause : une vérification anti-robot, trop de demandes, des erreurs en série. */
export type GuardReason = "bot" | "limit" | "errors";

/** Ce que l'administration voit d'une source. */
export type GuardStatus = { state: "normal" } | { state: "paused"; until: number; reason: GuardReason };

export interface BreakerSnapshot {
  openUntil: number;
  nextOpenMs: number;
  reason: GuardReason | null;
}

const minutes = (ms: number) => Math.max(1, Math.round(ms / 60_000));

/** N appels par fenêtre glissante. */
export class SlidingBudget {
  private starts: number[] = [];

  constructor(readonly limit: number, private readonly windowMs: number) {}

  private prune(now: number): void {
    while (this.starts.length > 0 && this.starts[0] <= now - this.windowMs) this.starts.shift();
  }

  /** Dans combien de ms une place se libère, ou `null` s'il en reste une. */
  refusal(now = Date.now()): number | null {
    this.prune(now);
    return this.starts.length < this.limit ? null : this.starts[0] + this.windowMs - now;
  }

  count(now = Date.now()): void {
    this.starts.push(now);
  }

  /** Les appels qui restent dans la fenêtre. */
  remaining(now = Date.now()): number {
    this.prune(now);
    return Math.max(0, this.limit - this.starts.length);
  }

  snapshot(now = Date.now()): number[] {
    this.prune(now);
    return [...this.starts];
  }

  restore(starts: readonly number[], now = Date.now()): void {
    this.starts = starts.filter((t) => Number.isFinite(t) && t <= now).sort((a, b) => a - b).slice(-this.limit);
    this.prune(now);
  }

  reset(): void {
    this.starts = [];
  }
}

/** Un seau : `capacity` appels d'avance, puis un de plus tous les `refillMs` — par clé (un compte, ou « * »). */
export class TokenBuckets {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();

  constructor(private readonly capacity: number, private readonly refillMs: number, private readonly maxKeys = 1_000) {}

  /** Prend une place : 0 si accordée, sinon dans combien de ms en redemander une. */
  take(key = "*", now = Date.now()): number {
    const known = this.buckets.get(key);
    const tokens = known ? Math.min(this.capacity, known.tokens + (now - known.at) / this.refillMs) : this.capacity;
    this.buckets.delete(key);
    if (tokens < 1) {
      this.buckets.set(key, { tokens, at: now });
      return Math.max(1, Math.ceil((1 - tokens) * this.refillMs));
    }
    this.buckets.set(key, { tokens: tokens - 1, at: now });
    while (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) break;
      this.buckets.delete(oldest);
    }
    return 0;
  }

  reset(): void {
    this.buckets.clear();
  }
}

export interface BreakerOptions {
  baseMs?: number;
  maxMs?: number;
  /** La ligne du journal à l'ouverture (`minutes` : la durée de cette pause). */
  tripLine: (reason: GuardReason, minutes: number) => string;
  /** La ligne du journal quand la source répond de nouveau. */
  recoveredLine: string;
}

const BASE_MS = 30 * 60_000;
const MAX_MS = 4 * 60 * 60_000;

/** Le disjoncteur d'une source. */
export class SourceBreaker {
  private openUntil = 0;
  private nextOpenMs: number;
  private reason: GuardReason | null = null;
  private listener: (() => void) | null = null;
  private readonly baseMs: number;
  private readonly maxMs: number;

  constructor(private readonly options: BreakerOptions) {
    this.baseMs = options.baseMs ?? BASE_MS;
    this.maxMs = options.maxMs ?? MAX_MS;
    this.nextOpenMs = this.baseMs;
  }

  /** La source refuse : pause de la durée en cours, la suivante doublée. Sans effet si déjà ouvert. */
  trip(reason: GuardReason, now = Date.now()): void {
    if (this.openUntil > now) return;
    this.openUntil = now + this.nextOpenMs;
    this.reason = reason;
    console.warn(this.options.tripLine(reason, minutes(this.nextOpenMs)));
    this.nextOpenMs = Math.min(this.nextOpenMs * 2, this.maxMs);
    this.listener?.();
  }

  /** Un appel a réussi : la source répond, le disjoncteur se referme et repart de la durée de base. */
  recordSuccess(now = Date.now()): void {
    const changed = this.openUntil > now || this.nextOpenMs > this.baseMs;
    if (changed) console.log(this.options.recoveredLine);
    this.openUntil = 0;
    this.nextOpenMs = this.baseMs;
    this.reason = null;
    if (changed) this.listener?.();
  }

  /** Combien de ms de pause restent ; 0 : fermé. */
  remainingMs(now = Date.now()): number {
    return Math.max(0, this.openUntil - now);
  }

  status(now = Date.now()): GuardStatus {
    return this.openUntil > now ? { state: "paused", until: this.openUntil, reason: this.reason ?? "limit" } : { state: "normal" };
  }

  snapshot(): BreakerSnapshot {
    return { openUntil: this.openUntil, nextOpenMs: this.nextOpenMs, reason: this.reason };
  }

  restore(snapshot: Partial<BreakerSnapshot>): void {
    const until = Number(snapshot.openUntil);
    const next = Number(snapshot.nextOpenMs);
    this.openUntil = Number.isFinite(until) ? until : 0;
    this.nextOpenMs = Number.isFinite(next) ? Math.min(Math.max(next, this.baseMs), this.maxMs) : this.baseMs;
    this.reason = snapshot.reason === "bot" || snapshot.reason === "limit" || snapshot.reason === "errors" ? snapshot.reason : null;
  }

  /** Prévient `listener` à chaque changement (l'état durable s'écrit alors). */
  onChange(listener: (() => void) | null): void {
    this.listener = listener;
  }

  reset(): void {
    this.openUntil = 0;
    this.nextOpenMs = this.baseMs;
    this.reason = null;
  }
}
