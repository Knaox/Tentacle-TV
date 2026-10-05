import type { JellyfinHealthState } from "./deviceSessions/protocolMessages";

/**
 * Jellyfin sert-il ? La machine d'états, pure — horloge et sonde injectées.
 *
 * Mesuré sur Jellyfin 10.11.11 (conteneur officiel, 2026-10-05) :
 *
 *  - `POST /System/Restart` : `ServerRestarting` sur TOUTES les sockets
 *    (clé d'API comprise) 100 ms après, fermeture 1000 « System Shutdown »,
 *    puis 503 « Jellyfin Server is loading » ~6,5 s, puis le retour.
 *  - `docker restart` / `docker stop` (SIGTERM) : `ServerShuttingDown` —
 *    jamais `ServerRestarting` : le processus ne sait pas qu'on le relance.
 *  - `docker kill` : rien d'annoncé, fermeture 1006.
 *  - Au démarrage, le serveur d'attente de 10.11 répond UNE FOIS 200 à
 *    `/System/Info/Public`, en camelCase et sans `Id`, puis ferme, puis 503 :
 *    la sonde le classe « starting » (`jellyfinHealthProbe.ts`), sinon le
 *    retour s'annonçait 6 s trop tôt.
 *
 * D'où les règles :
 *
 *  - une annonce (`announce`) vaut l'état tout de suite ;
 *  - une socket fermée ne conclut RIEN : elle lance la sonde. Deux échecs
 *    de suite → `down` ; une socket se ferme sans que Jellyfin tombe ;
 *  - après une annonce, un « ok » ne compte qu'une fois le serveur vu
 *    tomber (ou passé `ANNOUNCED_GRACE_MS`) — il sert encore quelques
 *    millisecondes après avoir annoncé son départ ;
 *  - « redémarre » tient `RESTART_PATIENCE_MS` avant de devenir « arrêté ».
 */

export type ProbeVerdict = "ok" | "starting" | "fail";

export interface HealthSnapshot {
  state: JellyfinHealthState;
  /** Heure (ms) où l'état a commencé. */
  since: number;
}

export interface HealthClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface HealthMachineDeps {
  probe(): Promise<ProbeVerdict>;
  clock: HealthClock;
}

/** Cadence de la sonde quand Jellyfin ne répond pas. */
export const PROBE_INTERVAL_MS = 3_000;
/** Cadence au bord : juste après une annonce, et pendant le chargement — le retour est proche. */
export const PROBE_FAST_MS = 1_000;
/** Combien d'échecs de suite font « arrêté ». */
export const FAILURES_FOR_DOWN = 2;
/** Après une annonce, un « ok » d'avant la chute ne compte pas — au plus ce délai. */
export const ANNOUNCED_GRACE_MS = 10_000;
/** Un redémarrage annoncé qui ne revient pas devient « arrêté ». */
export const RESTART_PATIENCE_MS = 60_000;

type Listener = (next: HealthSnapshot, previous: HealthSnapshot) => void;

export class JellyfinHealthMachine {
  private snapshot: HealthSnapshot;
  private failures = 0;
  private timer: unknown = null;
  private probing = false;
  private inFlight = false;
  private announcedAt: number | null = null;
  private sawGoAway = false;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly deps: HealthMachineDeps) {
    this.snapshot = { state: "up", since: deps.clock.now() };
  }

  current(): HealthSnapshot {
    return { ...this.snapshot };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Jellyfin annonce son départ sur sa socket (`ServerRestarting`, `ServerShuttingDown`). */
  announce(kind: "restarting" | "shutting-down"): void {
    this.announcedAt = this.deps.clock.now();
    this.sawGoAway = false;
    this.failures = 0;
    this.set(kind);
    this.startProbing(PROBE_FAST_MS);
  }

  /** La socket est tombée (fermeture, silence) : on va voir, sans rien conclure. */
  socketLost(): void {
    this.startProbing(0);
  }

  /** La socket a rouvert : Jellyfin sert sans doute — une sonde le confirme tout de suite. */
  socketOpened(): void {
    if (this.snapshot.state === "up") return;
    this.startProbing(0);
    this.probeNow();
  }

  /** Arrête la sonde (processus qui s'arrête, tests). */
  dispose(): void {
    this.probing = false;
    this.clearTimer();
  }

  private startProbing(firstDelay: number): void {
    if (this.probing) return;
    this.probing = true;
    this.schedule(firstDelay);
  }

  private probeNow(): void {
    this.clearTimer();
    void this.runProbe();
  }

  private schedule(delay: number): void {
    this.clearTimer();
    if (!this.probing) return;
    this.timer = this.deps.clock.setTimeout(() => {
      this.timer = null;
      void this.runProbe();
    }, delay);
  }

  private async runProbe(): Promise<void> {
    if (!this.probing || this.inFlight) return;
    this.inFlight = true;
    let verdict: ProbeVerdict;
    try {
      verdict = await this.deps.probe();
    } catch {
      verdict = "fail";
    } finally {
      this.inFlight = false;
    }
    this.apply(verdict);
    if (this.probing) this.schedule(this.nextDelay());
  }

  private nextDelay(): number {
    const { state } = this.snapshot;
    if (state === "starting") return PROBE_FAST_MS;
    const sinceAnnounce = this.announcedAt === null ? Infinity : this.deps.clock.now() - this.announcedAt;
    return sinceAnnounce < ANNOUNCED_GRACE_MS ? PROBE_FAST_MS : PROBE_INTERVAL_MS;
  }

  private apply(verdict: ProbeVerdict): void {
    const now = this.deps.clock.now();
    if (verdict === "ok") {
      // Annoncé, pas encore vu tomber : c'est le serveur qui finit de partir.
      if (this.announcedAt !== null && !this.sawGoAway && now - this.announcedAt < ANNOUNCED_GRACE_MS) return;
      this.failures = 0;
      this.announcedAt = null;
      this.sawGoAway = false;
      this.probing = false;
      this.clearTimer();
      this.set("up");
      return;
    }
    this.sawGoAway = true;
    if (verdict === "starting") {
      this.failures = 0;
      this.set("starting");
      return;
    }
    this.failures += 1;
    if (this.failures < FAILURES_FOR_DOWN) return;
    const announcedRestart = this.snapshot.state === "restarting" && this.announcedAt !== null;
    if (announcedRestart && now - (this.announcedAt as number) < RESTART_PATIENCE_MS) return;
    this.set("down");
  }

  private set(state: JellyfinHealthState): void {
    if (this.snapshot.state === state) return;
    const previous = this.snapshot;
    this.snapshot = { state, since: this.deps.clock.now() };
    for (const listener of [...this.listeners]) listener(this.current(), previous);
  }

  private clearTimer(): void {
    if (this.timer !== null) this.deps.clock.clearTimeout(this.timer);
    this.timer = null;
  }
}
