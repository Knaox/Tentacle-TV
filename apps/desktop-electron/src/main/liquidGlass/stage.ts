/**
 * La SCÈNE du verre d'une fenêtre : la racine posée sous le compositeur de
 * Chromium, et les `NSGlassEffectContainerView` qu'elle porte.
 *
 * Un conteneur par GROUPE (ses verres sont rendus ensemble et FUSIONNENT quand
 * ils s'approchent à moins de `spacing` points — le « liquide »), et un
 * conteneur SOLO par région sans groupe. Ce n'est pas du luxe : un verre ignore
 * son propre alpha, et seul celui de son conteneur l'estompe (mesuré, maquette
 * du 21/10) — chaque région seule peut donc entrer et sortir en fondu.
 *
 * Un conteneur qui sort en fondu QUITTE la table aussitôt (`retire`) : une
 * région du même groupe arrivée pendant le fondu en ouvre un neuf. Racine et
 * conteneurs n'existent que tant qu'un verre vit dessous (`prune`).
 */

import type { GlassBackend, GroupHandle, ViewHandle } from "./backend";
import { stackAnchor } from "./geometry";
import type { GlassEase } from "./protocol";

interface GroupEntry {
  readonly handle: GroupHandle;
  readonly seq: number;
  spacing: number;
}

interface Retiring {
  readonly handle: GroupHandle;
  readonly views: readonly ViewHandle[];
  readonly timer: ReturnType<typeof setTimeout>;
}

export interface Timers {
  set(callback: () => void, ms: number): ReturnType<typeof setTimeout>;
  clear(timer: ReturnType<typeof setTimeout>): void;
}

/** Marge laissée à l'animation d'AppKit avant de retirer ce qui s'est estompé. */
export const LEAVE_MARGIN_MS = 40;

export class GlassStage {
  private root: ViewHandle | null = null;
  private readonly groups = new Map<string, GroupEntry>();
  private readonly retiring = new Set<Retiring>();
  private surfaceVisible = true;
  private seq = 0;

  constructor(
    private readonly backend: GlassBackend,
    private readonly timers: Timers,
  ) {}

  has(key: string): boolean {
    return this.groups.has(key);
  }

  /** La vue de contenu du groupe, créée au besoin à l'alpha `alpha` — `null` si la fenêtre refuse la racine. */
  content(key: string, spacing: number, alpha = 1): ViewHandle | null {
    const known = this.groups.get(key);
    if (known !== undefined) return known.handle.content;
    const root = this.ensureRoot();
    if (root === null) return null;
    const handle = this.backend.createGroup(root, spacing, alpha);
    this.groups.set(key, { handle, seq: (this.seq += 1), spacing });
    return handle.content;
  }

  /** Fondu d'entrée d'un conteneur né transparent ; `ease` : la Bézier d'une matérialisation. */
  reveal(key: string, durationMs: number, ease?: GlassEase): void {
    const group = this.groups.get(key);
    if (group !== undefined) this.backend.setAlpha(group.handle.container, 1, durationMs, ease);
  }

  /**
   * Fondu de sortie d'un conteneur ENTIER, puis retrait de ses verres et de lui.
   * Les poignées `views` sont rendues au bout du fondu — jamais avant.
   */
  retire(key: string, durationMs: number, views: readonly ViewHandle[], ease?: GlassEase): void {
    const group = this.groups.get(key);
    if (group === undefined) return;
    this.groups.delete(key);
    this.backend.setAlpha(group.handle.container, 0, durationMs, ease);
    const entry: Retiring = {
      handle: group.handle,
      views,
      timer: this.timers.set(() => {
        this.retiring.delete(entry);
        this.finish(entry);
        this.prune(() => true);
      }, durationMs + LEAVE_MARGIN_MS),
    };
    this.retiring.add(entry);
  }

  /** Pose le conteneur d'un groupe parmi les autres : sous le premier plus profond (`topZ`). */
  restack(key: string, topZ: (key: string) => number): void {
    const group = this.groups.get(key);
    if (group === undefined || this.root === null || this.groups.size < 2) return;
    const items = [...this.groups].map(([k, g]) => ({ key: k, z: topZ(k), seq: g.seq }));
    const anchorKey = stackAnchor(items, key);
    const anchor = anchorKey === null ? null : this.groups.get(anchorKey)?.handle.container ?? null;
    this.backend.placeBelow(this.root, group.handle.container, anchor);
  }

  /** La distance de fusion d'un groupe — écrite seulement si elle change. */
  setSpacing(key: string, spacing: number): void {
    const group = this.groups.get(key);
    if (group === undefined || group.spacing === spacing) return;
    group.spacing = spacing;
    this.backend.setSpacing(group.handle, spacing);
  }

  /** Surface de Chromium opaque : tout le verre est masqué ; caché, il ne coûte plus rien. */
  setSurfaceVisible(visible: boolean): void {
    this.surfaceVisible = visible;
    if (this.root !== null) this.backend.setHidden(this.root, !visible);
  }

  isSurfaceVisible(): boolean {
    return this.surfaceVisible;
  }

  /** Démolit les groupes que `used` ne réclame plus, puis la racine si plus rien ne vit dessous. */
  prune(used: (key: string) => boolean): void {
    for (const [key, group] of this.groups) {
      if (used(key)) continue;
      this.backend.dispose(group.handle.container);
      this.groups.delete(key);
    }
    if (this.groups.size === 0 && this.retiring.size === 0 && this.root !== null) {
      this.backend.dispose(this.root);
      this.root = null;
    }
  }

  /** Solde tout de suite les fondus de sortie en cours (réglage coupé, page partie). */
  settleRetiring(): void {
    for (const entry of this.retiring) {
      this.timers.clear(entry.timer);
      this.finish(entry);
    }
    this.retiring.clear();
  }

  /** La fenêtre est détruite : rendre les références, sans un message à ses vues. */
  forget(): void {
    for (const entry of this.retiring) {
      this.timers.clear(entry.timer);
      for (const view of entry.views) this.backend.release(view);
      this.backend.release(entry.handle.container);
    }
    this.retiring.clear();
    for (const group of this.groups.values()) this.backend.release(group.handle.container);
    this.groups.clear();
    if (this.root !== null) this.backend.release(this.root);
    this.root = null;
  }

  hasRoot(): boolean {
    return this.root !== null;
  }

  groupCount(): number {
    return this.groups.size;
  }

  /** Les `NSGlassEffectView` réellement présentes, comptées dans AppKit. */
  nativeViews(): number {
    return this.root === null ? 0 : this.backend.countGlass(this.root);
  }

  private finish(entry: Retiring): void {
    for (const view of entry.views) this.backend.dispose(view);
    this.backend.dispose(entry.handle.container);
  }

  private ensureRoot(): ViewHandle | null {
    if (this.root !== null) return this.root;
    this.root = this.backend.createRoot();
    if (this.root !== null && !this.surfaceVisible) this.backend.setHidden(this.root, true);
    return this.root;
  }
}
