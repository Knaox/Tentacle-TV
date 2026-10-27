/**
 * Octave — la MÉCANIQUE des passages de la tenue à jour, sans React
 * (`syncRunner.test.ts`) : un passage à la fois, les demandes qui arrivent
 * pendant ce temps fusionnées en UN passage suivant, les signaux en rafale
 * retardés d'un instant. Ce qui se lit et ce qui se fait est injecté
 * (`useKeptAutoSync.ts` y branche le serveur, la coquille et le moteur).
 */

import type { KeptMusicCollection, KeptMusicTrack } from "@tentacle-tv/offline-core";
import type { MusicTrack, PendingMusicItem } from "@tentacle-tv/shared/music";
import { renamesOf } from "../keptRenames";
import type { SyncSignal } from "./syncSignals";
import { planSync, type SyncActions, type WantedForm } from "./syncPlan";

export interface RunnerDeps {
  refresh(): Promise<void>;
  state(): { tracks: readonly KeptMusicTrack[]; collections: readonly KeptMusicCollection[] };
  /** Les attentes de l'extension (les titres hors bibliothèque des playlists importées) ; `null` : illisibles. */
  readPending(): Promise<PendingMusicItem[] | null>;
  readPlaylists(collections: readonly KeptMusicCollection[], only: ReadonlySet<string> | null, pending: readonly PendingMusicItem[] | null): Promise<Map<string, MusicTrack[]>>;
  readTwins(tracks: readonly KeptMusicTrack[]): Promise<Map<string, MusicTrack>>;
  readWanted(tracks: readonly KeptMusicTrack[]): Promise<Map<string, WantedForm>>;
  canKeep(track: MusicTrack): boolean;
  apply(actions: SyncActions): Promise<void>;
  /** Le délai qui fond une rafale de signaux en un passage. */
  delayMs: number;
}

/**
 * `full` : tout relire (ouverture, reconnexion) ; `signals` : la playlist, les jumeaux, et — attentes changées —
 * les playlists de la bibliothèque gardées ; `local` : ne rien demander.
 */
export type Pass = { kind: "full" } | { kind: "signals"; playlists: Set<string>; twins: boolean; pending?: boolean } | { kind: "local" };

export function mergePasses(a: Pass | null, b: Pass): Pass {
  if (a === null || a.kind === "local") return b.kind === "local" && a !== null ? a : b;
  if (a.kind === "full" || b.kind === "full") return { kind: "full" };
  if (b.kind === "local") return a;
  const pending = a.pending === true || b.pending === true;
  return { kind: "signals", playlists: new Set([...a.playlists, ...b.playlists]), twins: a.twins || b.twins, ...(pending ? { pending } : {}) };
}

const LIBRARY_PLAYLIST = "playlist:jf:";
const isLibrary = (t: MusicTrack): boolean => !!t.jellyfinId && t.availability === "library";

export class SyncRunner {
  private readonly twins = new Map<string, MusicTrack>();
  private wanted = new Map<string, WantedForm>();
  private queued: Pass | null = null;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private readonly deps: RunnerDeps) {}

  /** Ouverture, réglage allumé, reconnexion : un relevé complet, tout de suite. */
  start(): void {
    this.now({ kind: "full" });
  }

  signal(signal: SyncSignal): void {
    if (signal.kind === "twin" && signal.track) this.twins.set(signal.externalKey, signal.track);
    if (signal.kind === "playlist") this.later({ kind: "signals", playlists: new Set([signal.playlistId]), twins: false });
    else if (signal.kind === "pending") this.later({ kind: "signals", playlists: new Set(), twins: false, pending: true });
    else this.later({ kind: "signals", playlists: new Set(), twins: true });
  }

  /** Un transfert vient de finir : la règle rejouée sur ce qui est su. */
  transferred(): void {
    this.later({ kind: "local" });
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) clearTimeout(this.timer);
  }

  /** Attendre que tout ce qui est demandé soit fait (tests). */
  async idle(): Promise<void> {
    while (this.running || this.timer !== null) {
      await this.running;
      await new Promise((r) => setTimeout(r, 2));
    }
  }

  private later(pass: Pass): void {
    this.queued = mergePasses(this.queued, pass);
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.drain();
    }, this.deps.delayMs);
  }

  private now(pass: Pass): void {
    this.queued = mergePasses(this.queued, pass);
    this.drain();
  }

  /**
   * Un passage à la fois. Le drapeau se lève dans un `finally` posé APRÈS
   * l'affectation : une boucle qui n'avait rien à faire (le minuteur d'un signal
   * dont la boucle en cours a déjà pris le passage) se finissait de façon
   * synchrone, AVANT que sa promesse soit retenue — `running` restait alors levé
   * pour toujours et plus rien ne tournait (vu au banc du bureau).
   */
  private drain(): void {
    if (this.running || this.stopped || this.queued === null) return;
    const loop = async (): Promise<void> => {
      while (this.queued && !this.stopped) {
        const pass = this.queued;
        this.queued = null;
        await this.run(pass).catch(() => undefined);
      }
    };
    this.running = loop().finally(() => {
      this.running = null;
    });
  }

  /** L'identité d'aujourd'hui d'un titre d'ailleurs gardé : jamais à la place de sa version Jellyfin (elle fait foi). */
  private rename(former: string, current: MusicTrack): void {
    const known = this.twins.get(former);
    if (!known || !isLibrary(known)) this.twins.set(former, current);
  }

  private async run(pass: Pass): Promise<void> {
    await this.deps.refresh();
    const { tracks, collections } = this.deps.state();
    if (tracks.length === 0 && collections.length === 0) return;
    let only: Set<string> | null = null;
    if (pass.kind === "signals") {
      only = new Set(pass.playlists);
      if (pass.pending) for (const c of collections) if (c.key.startsWith(LIBRARY_PLAYLIST)) only.add(c.key.slice(LIBRARY_PLAYLIST.length));
    }
    let playlists = new Map<string, MusicTrack[]>();
    if (pass.kind === "full" || (only !== null && only.size > 0)) {
      // Les attentes UNE fois par passage : les playlists de la bibliothèque s'y complètent, les identités changées s'y lisent.
      const pending = await this.deps.readPending();
      for (const [former, current] of renamesOf(pending ?? [])) this.rename(former, current);
      playlists = await this.deps.readPlaylists(collections, only, pending);
    }
    if (pass.kind === "full" || (pass.kind === "signals" && pass.twins)) for (const [k, v] of await this.deps.readTwins(tracks)) this.twins.set(k, v);
    if (pass.kind === "full") this.wanted = await this.deps.readWanted(tracks);
    if (this.stopped) return;
    const actions = planSync({ kept: tracks, collections, playlists, twins: this.twins, wanted: this.wanted, canKeep: (t) => this.deps.canKeep(t) });
    const empty = actions.keep.length + actions.removeFileIds.length + actions.saveCollections.length + actions.removeCollections.length === 0;
    if (!empty) await this.deps.apply(actions);
  }
}
