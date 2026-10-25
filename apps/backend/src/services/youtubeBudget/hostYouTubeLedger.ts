/* ------------------------------------------------------------------ */
/*  Le budget YouTube UNIQUE de l'hôte                                  */
/*                                                                     */
/*  Une seule adresse IP sort vers YouTube : les bandes-annonces du     */
/*  cœur et les extensions qui empruntent un outil (Sillon : recherche  */
/*  et extraction de musique). Chacun avait son budget (30 + 60/h pour  */
/*  les bandes-annonces, 150/h pour Sillon) — 240/h possibles, quand    */
/*  l'anti-robot tombe vers ~150 (mesuré le 2026-10-14). Ce registre    */
/*  compte TOUT sur la même fenêtre glissante :                         */
/*  - plafond de l'hôte : 150 par heure ;                               */
/*  - bandes-annonces : comportement inchangé tant que le total de      */
/*    l'heure reste sous 150 (leurs propres budgets restent devant) ;   */
/*  - extensions : une lecture (`play`) tant que le total < 140, une     */
/*    anticipation (`prefetch`) tant qu'il < 110 — il reste toujours    */
/*    ≥ 40 par heure aux bandes-annonces et aux clics ; 100 par heure   */
/*    au plus par extension ; 20 par minute (tout compris), dont 12 au  */
/*    plus pour une anticipation : la minute garde TOUJOURS 8 places    */
/*    aux gestes (clic, recherche validée) et aux bandes-annonces — le  */
/*    fond ne fait plus attendre un clic d'une minute (25/10) ; une     */
/*    cadence de 250 ms entre deux places accordées à une extension ;   */
/*  - le disjoncteur est COMMUN (celui des bandes-annonces) : un        */
/*    anti-robot vu par l'un arrête l'autre ; disjoncteur ouvert, une   */
/*    lecture-sonde d'extension toutes les 5 min.                       */
/*  Pur : l'horloge est passée en argument, le disjoncteur injecté.    */
/* ------------------------------------------------------------------ */

export type ExtensionKind = "play" | "prefetch";

export type ExtensionAdmission =
  | { granted: true; waitMs: number }
  | { granted: false; reason: "blocked" | "budget"; retryAfterMs: number };

/** Ce que le registre attend du disjoncteur commun (`SourceBreaker` des bandes-annonces). */
export interface SharedBreaker {
  remainingMs(now: number): number;
  trip(reason: "bot", now: number): void;
  recordSuccess(now: number): void;
  /** L'instant de la dernière ouverture (`null` : jamais). */
  lastTripAt(): number | null;
}

export interface LedgerLimits {
  perHour: number;
  perMinute: number;
  /** Une anticipation d'extension n'est admise que sous ce total de la minute (toutes sources). */
  prefetchPerMinute: number;
  playBelow: number;
  prefetchBelow: number;
  perExtensionHour: number;
  extensionSpacingMs: number;
  probeEveryMs: number;
}

export const HOST_YOUTUBE_LIMITS: LedgerLimits = {
  perHour: 150,
  perMinute: 20,
  prefetchPerMinute: 12,
  playBelow: 140,
  prefetchBelow: 110,
  perExtensionHour: 100,
  extensionSpacingMs: 250,
  probeEveryMs: 5 * 60_000,
};

/** Une requête comptée : de qui (une bande-annonce, ou l'identifiant d'une extension), quand. */
export interface LedgerEntry {
  at: number;
  source: string;
}

export const TRAILER_SOURCE = "trailers";

const HOUR = 3_600_000;
const MINUTE = 60_000;

export class HostYouTubeLedger {
  private entries: LedgerEntry[] = [];
  private nextExtensionStart = 0;
  private lastProbeAt = -Infinity;

  constructor(private readonly breaker: SharedBreaker, private readonly limits: LedgerLimits = HOST_YOUTUBE_LIMITS) {}

  /**
   * Une bande-annonce peut-elle extraire ? `null` : oui (à compter ensuite par
   * `countTrailer`), sinon dans combien de ms une place se libère. Ne refuse
   * QUE l'heure pleine : sous elle, rien ne change pour les bandes-annonces.
   */
  trailerRefusal(now: number): number | null {
    this.prune(now);
    return this.entries.length < this.limits.perHour ? null : this.freedAfter(this.entries.length - this.limits.perHour + 1, now);
  }

  countTrailer(now: number): void {
    this.entries.push({ at: now, source: TRAILER_SOURCE });
  }

  /** Une place pour `cost` requêtes d'une extension (comptées dès l'accord, à l'instant où elles partiront). */
  admitExtension(pluginId: string, kind: ExtensionKind, cost: number, now: number): ExtensionAdmission {
    this.prune(now);
    const open = this.breaker.remainingMs(now);
    let probe = false;
    if (open > 0) {
      // Disjoncteur ouvert : seule une lecture-sonde, de loin en loin — c'est elle qui le refermera.
      if (kind !== "play" || now - this.lastProbeAt < this.limits.probeEveryMs) return { granted: false, reason: "blocked", retryAfterMs: open };
      probe = true;
    }
    if (!probe) {
      const below = kind === "play" ? this.limits.playBelow : this.limits.prefetchBelow;
      const total = this.entries.length;
      if (total + cost > below) return this.budget(total + cost - below, this.entries, now, HOUR);
      const minute = this.entries.filter((e) => e.at > now - MINUTE);
      if (minute.length + cost > this.limits.perMinute) return this.budget(minute.length + cost - this.limits.perMinute, minute, now, MINUTE);
      if (kind === "prefetch" && minute.length + cost > this.limits.prefetchPerMinute) {
        return this.budget(minute.length + cost - this.limits.prefetchPerMinute, minute, now, MINUTE);
      }
      const own = this.entries.filter((e) => e.source === pluginId);
      if (own.length + cost > this.limits.perExtensionHour) return this.budget(own.length + cost - this.limits.perExtensionHour, own, now, HOUR);
    } else this.lastProbeAt = now;
    const startAt = Math.max(now, this.nextExtensionStart);
    this.nextExtensionStart = startAt + this.limits.extensionSpacingMs * cost;
    for (let i = 0; i < cost; i++) this.entries.push({ at: startAt, source: pluginId });
    return { granted: true, waitMs: startAt - now };
  }

  /** Le verdict d'une requête accordée : `antiBot` ouvre le disjoncteur commun ; `ok`, partie APRÈS la dernière ouverture, le referme. */
  report(outcome: "ok" | "antiBot", startedAt: number, now: number): void {
    if (outcome === "antiBot") {
      this.breaker.trip("bot", now);
      return;
    }
    const trippedAt = this.breaker.lastTripAt();
    if (trippedAt === null || startedAt >= trippedAt) this.breaker.recordSuccess(now);
  }

  /** Requêtes de l'heure, toutes sources (administration, mesures). */
  usedInHour(now: number): number {
    this.prune(now);
    return this.entries.length;
  }

  snapshot(now: number): LedgerEntry[] {
    this.prune(now);
    return this.entries.map((e) => ({ ...e }));
  }

  restore(entries: readonly LedgerEntry[], now: number): void {
    this.entries = entries
      .filter((e) => Number.isFinite(e.at) && e.at <= now && typeof e.source === "string" && e.source.length <= 100)
      .map((e) => ({ at: e.at, source: e.source }))
      .sort((a, b) => a.at - b.at)
      .slice(-this.limits.perHour * 2);
    this.prune(now);
  }

  reset(): void {
    this.entries = [];
    this.nextExtensionStart = 0;
    this.lastProbeAt = -Infinity;
  }

  /** Refus de budget : dans combien de ms `excess` places de `among` (triées) seront sorties de la fenêtre. */
  private budget(excess: number, among: readonly LedgerEntry[], now: number, windowMs: number): ExtensionAdmission {
    const entry = among[Math.min(among.length, Math.max(1, excess)) - 1];
    return { granted: false, reason: "budget", retryAfterMs: Math.max(1, (entry?.at ?? now) + windowMs - now) };
  }

  private freedAfter(count: number, now: number): number {
    const entry = this.entries[Math.min(this.entries.length, count) - 1];
    return Math.max(1, (entry?.at ?? now) + HOUR - now);
  }

  private prune(now: number): void {
    // Les places accordées d'avance (cadence) sont « dans le futur » : elles restent comptées.
    this.entries = this.entries.filter((e) => e.at > now - HOUR);
    this.entries.sort((a, b) => a.at - b.at);
  }
}
