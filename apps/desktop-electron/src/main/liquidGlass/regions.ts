/**
 * Les régions de verre d'UNE fenêtre : ce que la page a demandé, et les vues
 * natives qui le rendent.
 *
 * Le gestionnaire ne parle jamais à AppKit directement (`backend.ts`) : il
 * décide, la couche native exécute. Ses règles :
 *
 *  1. **Rien de posé qui ne sert.** Sans région, ni racine, ni conteneur.
 *     Réglage coupé : tout est retiré, seules les DESCRIPTIONS restent.
 *  2. **N'écrire que ce qui change.**
 *  3. **Une poignée rendue n'est plus jamais touchée** — c'est un pointeur.
 *  4. **Les mouvements de la page, rejoués par AppKit** (`transition` non nul) :
 *     déplacement au ressort de la page (`springCurve.ts`) ; une région seule,
 *     ou un groupe entier, entre et sort par le fondu de son conteneur (un verre
 *     ignore son propre alpha, mesuré) ; un membre qui quitte un groupe qui
 *     reste fond vers son centre, un membre qui rejoint un groupe visible en naît.
 */

import type { GlassBackend, ViewHandle } from "./backend";
import { nativeStyle, parseTint, sameRect, stackAnchor, toAppKitFrame, toPointRadius, toPoints, type AppKitRect, type PointRect } from "./geometry";
import { MAX_REGIONS, type LiquidGlassBatch, type NativeGlassRegion } from "./protocol";
import { describeRegion, type RegionsSnapshot } from "./snapshot";
import { GLASS_SPRINGS, springMotion, type NativeMotion } from "./springCurve";
import { GlassStage, LEAVE_MARGIN_MS, type Timers } from "./stage";

export type { Timers } from "./stage";

interface RegionEntry {
  region: NativeGlassRegion;
  /** En points, origine en haut à gauche. */
  rect: PointRect;
  radius: number;
  groupKey: string;
  readonly seq: number;
  view: ViewHandle | null;
}

/** Le conteneur d'une région : celui de son groupe, ou le sien seul. */
const keyOf = (region: NativeGlassRegion): string =>
  region.group === undefined ? `seule:${region.id}` : `groupe:${region.group}`;

/** Un point au centre du cadre : d'où un verre naît, où il fond. */
const centerOf = (frame: AppKitRect): AppKitRect => ({
  x: frame.x + frame.width / 2,
  y: frame.y + frame.height / 2,
  width: 0,
  height: 0,
});

/** Le mouvement natif d'une région : son ressort, `morph` de la page sinon ; aucun sans transition. */
function motionOf(region: NativeGlassRegion): NativeMotion | null {
  if ((region.transition ?? 0) <= 0) return null;
  return springMotion(region.spring ?? GLASS_SPRINGS.morph);
}

export class GlassRegions {
  private enabled = true;
  private readonly stage: GlassStage;
  private readonly regions = new Map<string, RegionEntry>();
  /** Verres qui fondent vers leur centre en quittant un groupe qui reste. */
  private readonly shrinking = new Map<ViewHandle, { timer: ReturnType<typeof setTimeout>; groupKey: string }>();
  private seq = 0;
  private overflowTold = false;

  constructor(
    private readonly backend: GlassBackend,
    private readonly timers: Timers,
    private readonly log: (message: string) => void,
  ) {
    this.stage = new GlassStage(backend, timers);
  }

  /** Un lot : le réglage, les départs, les poses, les fondus d'entrée — et le ménage une fois. */
  apply(batch: LiquidGlassBatch, zoom: number): void {
    if (batch.enabled !== undefined) this.setEnabled(batch.enabled);
    this.depart(batch.removes, new Set(batch.upserts.map(keyOf)));
    if (batch.upserts.length > 0) {
      const height = this.enabled ? this.backend.contentHeight() : 0;
      const reveal = new Map<string, number>();
      for (const region of batch.upserts) this.upsert(region, zoom, height, reveal);
      for (const [key, ms] of reveal) this.stage.reveal(key, ms);
    }
    this.prune();
  }

  setEnabled(next: boolean): void {
    if (next === this.enabled) return;
    this.enabled = next;
    if (!next) return this.demolish();
    const height = this.backend.contentHeight();
    const ordered = [...this.regions.values()].sort((a, b) => a.region.z - b.region.z || a.seq - b.seq);
    for (const entry of ordered) this.mount(entry, height, null);
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
    for (const [view, leaving] of this.shrinking) {
      this.timers.clear(leaving.timer);
      this.backend.release(view);
    }
    this.shrinking.clear();
    for (const entry of this.regions.values()) {
      if (entry.view !== null) this.backend.release(entry.view);
      entry.view = null;
    }
    this.regions.clear();
    this.stage.forget();
  }

  snapshot(): RegionsSnapshot {
    const regions = [...this.regions.values()].map((entry) =>
      describeRegion(entry.region, entry.view === null ? null : this.backend.inspect(entry.view)),
    );
    return {
      enabled: this.enabled,
      surfaceVisible: this.stage.isSurfaceVisible(),
      root: this.stage.hasRoot(),
      groups: this.stage.groupCount(),
      nativeViews: this.stage.nativeViews(),
      regions,
    };
  }

  /** Les départs d'un lot : un groupe qui se vide sort en fondu ENTIER, sinon chacun fond vers son centre. */
  private depart(ids: readonly string[], arriving: ReadonlySet<string>): void {
    const removed: RegionEntry[] = [];
    for (const id of ids) {
      const entry = this.regions.get(id);
      if (entry === undefined) continue;
      this.regions.delete(id);
      removed.push(entry);
    }
    const retiring = new Map<string, { views: ViewHandle[]; ms: number }>();
    for (const entry of removed) {
      const view = entry.view;
      if (view === null) continue;
      entry.view = null;
      const ms = entry.region.transition ?? 0;
      if (ms <= 0) {
        this.backend.dispose(view);
      } else if (arriving.has(entry.groupKey) || this.hasLiveView(entry.groupKey)) {
        this.shrink(entry, view);
      } else {
        const bag = retiring.get(entry.groupKey) ?? { views: [], ms: 0 };
        bag.views.push(view);
        bag.ms = Math.max(bag.ms, ms);
        retiring.set(entry.groupKey, bag);
      }
    }
    for (const [key, bag] of retiring) this.stage.retire(key, bag.ms, bag.views);
  }

  private shrink(entry: RegionEntry, view: ViewHandle): void {
    const motion = motionOf(entry.region);
    this.backend.setFrame(view, centerOf(this.backend.inspect(view).frame), motion);
    const timer = this.timers.set(() => {
      this.shrinking.delete(view);
      this.backend.dispose(view);
      this.prune();
    }, (motion?.durationMs ?? 0) + LEAVE_MARGIN_MS);
    this.shrinking.set(view, { timer, groupKey: entry.groupKey });
  }

  private upsert(region: NativeGlassRegion, zoom: number, height: number, reveal: Map<string, number>): void {
    const rect = toPoints(region, zoom);
    const radius = toPointRadius(region, zoom);
    const groupKey = keyOf(region);
    const entry = this.regions.get(region.id);
    if (entry === undefined) {
      if (this.regions.size >= MAX_REGIONS) return this.overflow();
      const fresh: RegionEntry = { region, rect, radius, groupKey, seq: (this.seq += 1), view: null };
      this.regions.set(region.id, fresh);
      if (this.enabled) this.mount(fresh, height, reveal);
      return;
    }
    const previous = { region: entry.region, rect: entry.rect, radius: entry.radius };
    Object.assign(entry, { region, rect, radius });
    if (!this.enabled) return;
    if (entry.groupKey !== groupKey || entry.view === null) {
      // Changer de groupe, c'est changer de conteneur : on repose la vue.
      if (entry.view !== null) this.backend.dispose(entry.view);
      entry.view = null;
      entry.groupKey = groupKey;
      return this.mount(entry, height, reveal);
    }
    const view = entry.view;
    if (!sameRect(previous.rect, rect)) this.backend.setFrame(view, toAppKitFrame(rect, height), motionOf(region));
    if (Math.abs(previous.radius - radius) >= 0.01) this.backend.setRadius(view, radius);
    const style = nativeStyle(region.level);
    if (nativeStyle(previous.region.level) !== style) this.backend.setStyle(view, style);
    if (previous.region.tint !== region.tint) this.backend.setTint(view, parseTint(region.tint));
    if (previous.region.appearance !== region.appearance) this.backend.setAppearance(view, region.appearance ?? null);
    if (previous.region.z !== region.z) this.restack(entry);
    this.stage.setSpacing(groupKey, this.spacingOf(groupKey));
  }

  /** `reveal` nul : remontage d'un réglage rallumé, sans mouvement. */
  private mount(entry: RegionEntry, height: number, reveal: Map<string, number> | null): void {
    const ms = reveal === null ? 0 : entry.region.transition ?? 0;
    const opening = !this.stage.has(entry.groupKey) || (reveal?.has(entry.groupKey) ?? false);
    const content = this.stage.content(entry.groupKey, this.spacingOf(entry.groupKey), opening && ms > 0 ? 0 : 1);
    if (content === null) return;
    const frame = toAppKitFrame(entry.rect, height);
    const grow = !opening && ms > 0;
    entry.view = this.backend.createGlass({
      frame: grow ? centerOf(frame) : frame,
      radius: entry.radius,
      style: nativeStyle(entry.region.level),
      tint: parseTint(entry.region.tint),
      appearance: entry.region.appearance ?? null,
    });
    this.restack(entry);
    if (grow) this.backend.setFrame(entry.view, frame, motionOf(entry.region));
    if (opening && ms > 0 && reveal !== null) reveal.set(entry.groupKey, Math.max(reveal.get(entry.groupKey) ?? 0, ms));
    this.stage.setSpacing(entry.groupKey, this.spacingOf(entry.groupKey));
  }

  /** Pose la vue à sa place dans son conteneur (profondeur, puis arrivée), puis le conteneur parmi les autres. */
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

  private hasLiveView(key: string): boolean {
    for (const entry of this.regions.values()) if (entry.groupKey === key && entry.view !== null) return true;
    return false;
  }

  /** La profondeur d'un conteneur : celle de sa région posée la plus haute. */
  private topZ(key: string): number {
    let top = Number.NEGATIVE_INFINITY;
    for (const entry of this.regions.values()) {
      if (entry.groupKey === key && entry.view !== null) top = Math.max(top, entry.region.z);
    }
    return top;
  }

  /** La distance de fusion d'un groupe : la plus grande que ses régions demandent ; une région seule, 0. */
  private spacingOf(key: string): number {
    let spacing = 0;
    for (const entry of this.regions.values()) {
      if (entry.groupKey === key && entry.region.group !== undefined) spacing = Math.max(spacing, entry.region.spacing ?? 0);
    }
    return spacing;
  }

  /** Un conteneur sert tant qu'une région y est posée ou qu'un verre y fond. */
  private prune(): void {
    this.stage.prune(
      (key) => this.hasLiveView(key) || [...this.shrinking.values()].some((s) => s.groupKey === key),
    );
  }

  /** Tout retirer d'AppKit tout de suite : fondus soldés, verres, conteneurs, racine. */
  private demolish(): void {
    for (const [view, leaving] of this.shrinking) {
      this.timers.clear(leaving.timer);
      this.backend.dispose(view);
    }
    this.shrinking.clear();
    this.stage.settleRetiring();
    for (const entry of this.regions.values()) {
      if (entry.view !== null) this.backend.dispose(entry.view);
      entry.view = null;
    }
    this.prune();
  }

  private overflow(): void {
    if (this.overflowTold) return;
    this.overflowTold = true;
    this.log(`plus de ${MAX_REGIONS} regions de verre : les suivantes sont ignorees (fuite de la page ?)`);
  }
}
