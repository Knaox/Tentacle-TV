/**
 * Les régions de verre d'UNE fenêtre : ce que la page a demandé, et les vues
 * natives qui le rendent.
 *
 * Le gestionnaire ne parle jamais à AppKit directement (`backend.ts`) : il
 * décide, la couche native exécute. Trois règles le tiennent :
 *
 *  1. **Rien de posé qui ne sert.** Sans région, ni racine, ni groupe : la
 *     fenêtre est celle d'avant, vue pour vue (`stage.ts`). Réglage coupé : tout
 *     est retiré, seules les DESCRIPTIONS restent, pour tout reposer à l'identique.
 *  2. **N'écrire que ce qui change.** Une région renvoyée telle quelle ne coûte
 *     aucun message à AppKit.
 *  3. **Une poignée rendue n'est plus jamais touchée** — c'est un pointeur. Les
 *     disparitions animées gardent la leur jusqu'au bout, et sont soldées avant
 *     toute démolition.
 */

import type { GlassBackend, ViewHandle } from "./backend";
import { nativeStyle, parseTint, sameRect, stackAnchor, toAppKitFrame, toPointRadius, toPoints, type PointRect } from "./geometry";
import { MAX_REGIONS, type LiquidGlassBatch, type NativeGlassRegion } from "./protocol";
import type { RegionSnapshot, RegionsSnapshot } from "./snapshot";
import { GlassStage } from "./stage";

interface RegionEntry {
  region: NativeGlassRegion;
  /** En points, origine en haut à gauche. */
  rect: PointRect;
  radius: number;
  groupKey: string;
  readonly seq: number;
  view: ViewHandle | null;
}

interface Leaving {
  readonly timer: ReturnType<typeof setTimeout>;
  readonly groupKey: string;
}

export interface Timers {
  set(callback: () => void, ms: number): ReturnType<typeof setTimeout>;
  clear(timer: ReturnType<typeof setTimeout>): void;
}

const DEFAULT_GROUP = "";
/** Marge laissée à l'animation d'AppKit avant de retirer une vue qui s'efface. */
const LEAVE_MARGIN_MS = 40;

export class GlassRegions {
  private enabled = true;
  private readonly stage: GlassStage;
  private readonly regions = new Map<string, RegionEntry>();
  private readonly leaving = new Map<ViewHandle, Leaving>();
  private seq = 0;
  private overflowTold = false;

  constructor(
    private readonly backend: GlassBackend,
    private readonly timers: Timers,
    private readonly log: (message: string) => void,
  ) {
    this.stage = new GlassStage(backend);
  }

  /**
   * Un lot de la page : le réglage d'abord, les retraits ensuite, les poses
   * enfin — et le ménage UNE fois, à la fin : un groupe vidé puis rempli dans le
   * même lot n'est pas démoli pour rien.
   */
  apply(batch: LiquidGlassBatch, zoom: number): void {
    if (batch.enabled !== undefined) this.setEnabled(batch.enabled);
    for (const id of batch.removes) this.remove(id);
    if (batch.upserts.length > 0) {
      const height = this.enabled ? this.backend.contentHeight() : 0;
      for (const region of batch.upserts) this.upsert(region, zoom, height);
    }
    this.prune();
  }

  setEnabled(next: boolean): void {
    if (next === this.enabled) return;
    this.enabled = next;
    if (!next) return this.demolish();
    const height = this.backend.contentHeight();
    const ordered = [...this.regions.values()].sort((a, b) => a.region.z - b.region.z || a.seq - b.seq);
    for (const entry of ordered) this.mount(entry, height, 0);
  }

  /** La surface de Chromium est-elle transparente ? Voir `GlassStage.setSurfaceVisible`. */
  setSurfaceVisible(visible: boolean): void {
    this.stage.setSurfaceVisible(visible);
  }

  /** La page est partie (rechargement, processus perdu) : plus rien de ce qu'elle avait demandé. */
  clear(): void {
    this.demolish();
    this.regions.clear();
  }

  /** La fenêtre est détruite : rendre les références sans toucher à AppKit. */
  forget(): void {
    for (const [view, leaving] of this.leaving) {
      this.timers.clear(leaving.timer);
      this.backend.release(view);
    }
    this.leaving.clear();
    for (const entry of this.regions.values()) {
      if (entry.view !== null) this.backend.release(entry.view);
      entry.view = null;
    }
    this.regions.clear();
    this.stage.forget();
  }

  snapshot(): RegionsSnapshot {
    const regions = [...this.regions.values()].map((entry): RegionSnapshot => {
      const native = entry.view === null ? null : this.backend.inspect(entry.view);
      const { region } = entry;
      return {
        id: region.id,
        level: region.level,
        group: entry.groupKey === DEFAULT_GROUP ? null : entry.groupKey,
        z: region.z,
        css: { x: region.x, y: region.y, width: region.width, height: region.height, radius: region.radius },
        frame: native?.frame ?? null,
        radius: native?.radius ?? null,
        style: native?.style ?? null,
        hidden: native === null || native.hidden || native.alpha === 0,
      };
    });
    return {
      enabled: this.enabled,
      surfaceVisible: this.stage.isSurfaceVisible(),
      root: this.stage.hasRoot(),
      groups: this.stage.groupCount(),
      nativeViews: this.stage.nativeViews(),
      regions,
    };
  }

  private upsert(region: NativeGlassRegion, zoom: number, height: number): void {
    const rect = toPoints(region, zoom);
    const radius = toPointRadius(region, zoom);
    const groupKey = region.group ?? DEFAULT_GROUP;
    const entry = this.regions.get(region.id);
    if (entry === undefined) {
      if (this.regions.size >= MAX_REGIONS) return this.overflow();
      const fresh: RegionEntry = { region, rect, radius, groupKey, seq: (this.seq += 1), view: null };
      this.regions.set(region.id, fresh);
      if (this.enabled) this.mount(fresh, height, region.transition ?? 0);
      return;
    }
    const previous = { region: entry.region, rect: entry.rect, radius: entry.radius };
    Object.assign(entry, { region, rect, radius });
    if (!this.enabled) return;
    if (entry.groupKey !== groupKey || entry.view === null) {
      // Changer de groupe, c'est changer de conteneur : on repose la vue.
      this.unmount(entry, 0);
      entry.groupKey = groupKey;
      return this.mount(entry, height, 0);
    }
    const view = entry.view;
    if (!sameRect(previous.rect, rect)) this.backend.setFrame(view, toAppKitFrame(rect, height), region.transition ?? 0);
    if (Math.abs(previous.radius - radius) >= 0.01) this.backend.setRadius(view, radius);
    const style = nativeStyle(region.level);
    if (nativeStyle(previous.region.level) !== style) this.backend.setStyle(view, style);
    if (previous.region.tint !== region.tint) this.backend.setTint(view, parseTint(region.tint));
    if (previous.region.z !== region.z) this.restack(entry);
    this.stage.setSpacing(groupKey, this.spacingOf(groupKey));
  }

  private remove(id: string): void {
    const entry = this.regions.get(id);
    if (entry === undefined) return;
    this.regions.delete(id);
    this.unmount(entry, entry.region.transition ?? 0);
  }

  private mount(entry: RegionEntry, height: number, fadeMs: number): void {
    if (this.stage.content(entry.groupKey, this.spacingOf(entry.groupKey)) === null) return;
    entry.view = this.backend.createGlass({
      frame: toAppKitFrame(entry.rect, height),
      radius: entry.radius,
      style: nativeStyle(entry.region.level),
      tint: parseTint(entry.region.tint),
      alpha: fadeMs > 0 ? 0 : 1,
    });
    this.restack(entry);
    if (fadeMs > 0) this.backend.setAlpha(entry.view, 1, fadeMs);
    this.stage.setSpacing(entry.groupKey, this.spacingOf(entry.groupKey));
  }

  /** Retire la vue d'une région ; en fondu si `fadeMs` > 0. */
  private unmount(entry: RegionEntry, fadeMs: number): void {
    const view = entry.view;
    if (view === null) return;
    entry.view = null;
    if (fadeMs <= 0) return this.backend.dispose(view);
    this.backend.setAlpha(view, 0, fadeMs);
    const timer = this.timers.set(() => {
      this.leaving.delete(view);
      this.backend.dispose(view);
      this.prune();
    }, fadeMs + LEAVE_MARGIN_MS);
    this.leaving.set(view, { timer, groupKey: entry.groupKey });
  }

  /** Pose la vue à sa place dans son groupe (profondeur, puis arrivée), puis le groupe parmi les autres. */
  private restack(entry: RegionEntry): void {
    const content = this.stage.content(entry.groupKey, this.spacingOf(entry.groupKey));
    if (content === null || entry.view === null) return;
    const siblings = [...this.regions.values()].filter((e) => e.groupKey === entry.groupKey && e.view !== null);
    const anchorKey = stackAnchor(
      siblings.map((e) => ({ key: e.region.id, z: e.region.z, seq: e.seq })),
      entry.region.id,
    );
    const anchor = anchorKey === null ? null : this.regions.get(anchorKey)?.view ?? null;
    this.backend.placeBelow(content, entry.view, anchor);
    this.stage.restack(entry.groupKey, (key) => this.topZ(key));
  }

  /** La profondeur d'un groupe : celle de sa région posée la plus haute. */
  private topZ(key: string): number {
    let top = Number.NEGATIVE_INFINITY;
    for (const entry of this.regions.values()) {
      if (entry.groupKey === key && entry.view !== null) top = Math.max(top, entry.region.z);
    }
    return top;
  }

  /**
   * La distance de fusion d'un groupe : la plus grande que ses régions
   * demandent. Le groupe par défaut ne fusionne JAMAIS : une région sans groupe
   * est seule (contrat de la page), même si elle porte un `spacing`.
   */
  private spacingOf(key: string): number {
    if (key === DEFAULT_GROUP) return 0;
    let spacing = 0;
    for (const entry of this.regions.values()) {
      if (entry.groupKey === key) spacing = Math.max(spacing, entry.region.spacing ?? 0);
    }
    return spacing;
  }

  /** Un groupe sert tant qu'une région y est posée ou qu'un verre s'y efface. */
  private prune(): void {
    this.stage.prune(
      (key) =>
        [...this.regions.values()].some((e) => e.groupKey === key && e.view !== null) ||
        [...this.leaving.values()].some((l) => l.groupKey === key),
    );
  }

  /** Tout retirer d'AppKit, dans l'ordre : verres, groupes, racine. Les descriptions restent. */
  private demolish(): void {
    for (const [view, leaving] of this.leaving) {
      this.timers.clear(leaving.timer);
      this.backend.dispose(view);
    }
    this.leaving.clear();
    for (const entry of this.regions.values()) this.unmount(entry, 0);
    this.prune();
  }

  private overflow(): void {
    if (this.overflowTold) return;
    this.overflowTold = true;
    this.log(`plus de ${MAX_REGIONS} regions de verre : les suivantes sont ignorees (fuite de la page ?)`);
  }
}
