/**
 * Une fausse couche native pour les tests de `regions.ts` : un arbre de vues en
 * mémoire, et un journal des gestes.
 *
 * Elle LÈVE dès qu'on touche une poignée rendue : c'est la règle qui, en vrai,
 * tuerait le processus (`backend.ts`, « la propriété des vues »).
 */

import type { GlassBackend, GlassInspection, GlassProps, GroupHandle, ViewHandle } from "./backend";
import type { AppKitRect, Rgba } from "./geometry";
import type { GlassAppearance, GlassEase } from "./protocol";
import type { NativeMotion } from "./springCurve";

export interface FakeView {
  readonly kind: "content" | "root" | "container" | "groupContent" | "glass";
  readonly name: string;
  parent: FakeView | null;
  children: FakeView[];
  frame: AppKitRect;
  radius: number;
  style: number;
  tint: Rgba | null;
  alpha: number;
  hidden: boolean;
  spacing: number;
  appearance: GlassAppearance | null;
  released: boolean;
}

export class FakeBackend implements GlassBackend {
  readonly content: FakeView = this.make("content", "contentView");
  readonly ops: string[] = [];
  /** Chaque cadre posé par `setFrame`, dans l'ordre. */
  readonly frames: AppKitRect[] = [];
  height = 800;
  private counter = 0;

  private make(kind: FakeView["kind"], name: string): FakeView {
    return { kind, name, parent: null, children: [], frame: { x: 0, y: 0, width: 0, height: 0 }, radius: 0, style: 0, tint: null, alpha: 1, hidden: false, spacing: 0, appearance: null, released: false };
  }

  private view(handle: ViewHandle): FakeView {
    const view = handle.native as FakeView;
    if (view.released) throw new Error(`poignee rendue touchee : ${view.name}`);
    return view;
  }

  private detach(view: FakeView): void {
    if (view.parent === null) return;
    view.parent.children = view.parent.children.filter((child) => child !== view);
    view.parent = null;
  }

  createRoot(): ViewHandle {
    this.ops.push("createRoot");
    const root = this.make("root", "root");
    root.parent = this.content;
    this.content.children.unshift(root);
    return { native: root };
  }

  contentHeight(): number {
    return this.height;
  }

  setHidden(handle: ViewHandle, hidden: boolean): void {
    this.ops.push(`setHidden ${String(hidden)}`);
    this.view(handle).hidden = hidden;
  }

  createGroup(root: ViewHandle, spacing: number, alpha: number): GroupHandle {
    this.counter += 1;
    this.ops.push(`createGroup ${String(spacing)} alpha ${String(alpha)}`);
    const container = this.make("container", `container${String(this.counter)}`);
    const content = this.make("groupContent", `groupContent${String(this.counter)}`);
    container.spacing = spacing;
    container.alpha = alpha;
    container.children.push(content);
    content.parent = container;
    const parent = this.view(root);
    container.parent = parent;
    parent.children.push(container);
    return { container: { native: container }, content: { native: content } };
  }

  setSpacing(group: GroupHandle, spacing: number): void {
    this.ops.push(`setSpacing ${String(spacing)}`);
    this.view(group.container).spacing = spacing;
  }

  createGlass(props: GlassProps): ViewHandle {
    this.counter += 1;
    this.ops.push("createGlass");
    const glass = this.make("glass", `glass${String(this.counter)}`);
    Object.assign(glass, { frame: props.frame, radius: props.radius, style: props.style, tint: props.tint, appearance: props.appearance });
    return { native: glass };
  }

  setFrame(handle: ViewHandle, frame: AppKitRect, motion: NativeMotion | null): void {
    this.ops.push(`setFrame ${motion === null ? "direct" : `ressort ${String(motion.durationMs)}`}`);
    this.frames.push(frame);
    this.view(handle).frame = frame;
  }

  setAppearance(handle: ViewHandle, appearance: GlassAppearance | null): void {
    this.ops.push(`setAppearance ${String(appearance)}`);
    this.view(handle).appearance = appearance;
  }

  setRadius(handle: ViewHandle, radius: number): void {
    this.ops.push("setRadius");
    this.view(handle).radius = radius;
  }

  setStyle(handle: ViewHandle, style: 0 | 1): void {
    this.ops.push("setStyle");
    this.view(handle).style = style;
  }

  setTint(handle: ViewHandle, tint: Rgba | null): void {
    this.ops.push("setTint");
    this.view(handle).tint = tint;
  }

  setAlpha(handle: ViewHandle, alpha: number, durationMs: number, ease?: GlassEase): void {
    const view = this.view(handle);
    // Comme AppKit : sur un verre, l'alpha ne fait rien (mesuré) — le test le saurait.
    if (view.kind === "glass") throw new Error("alpha pose sur un verre : sans effet dans AppKit");
    this.ops.push(`setAlpha ${view.kind} ${String(alpha)} ${String(durationMs)}${ease === undefined ? "" : ` [${ease.join(",")}]`}`);
    view.alpha = alpha;
  }

  placeBelow(parentHandle: ViewHandle, handle: ViewHandle, anchor: ViewHandle | null): void {
    this.ops.push("placeBelow");
    const parent = this.view(parentHandle);
    const view = this.view(handle);
    this.detach(view);
    const index = anchor === null ? parent.children.length : parent.children.indexOf(this.view(anchor));
    if (index < 0) throw new Error("ancre hors du parent");
    parent.children.splice(index, 0, view);
    view.parent = parent;
  }

  dispose(handle: ViewHandle): void {
    const view = this.view(handle);
    this.ops.push(`dispose ${view.kind}`);
    this.detach(view);
    view.released = true;
  }

  release(handle: ViewHandle): void {
    const view = this.view(handle);
    this.ops.push(`release ${view.kind}`);
    view.released = true;
  }

  inspect(handle: ViewHandle): GlassInspection {
    const view = this.view(handle);
    // Comme `isHiddenOrHasHiddenAncestor` : une racine cachée cache tout ce qu'elle porte.
    let hidden = false;
    for (let v: FakeView | null = view; v !== null; v = v.parent) hidden ||= v.hidden;
    return { frame: view.frame, radius: view.radius, style: view.style, alpha: view.alpha, hidden };
  }

  countGlass(root: ViewHandle): number {
    const walk = (view: FakeView): number =>
      view.kind === "glass" ? 1 : view.children.reduce((total, child) => total + walk(child), 0);
    return walk(this.view(root));
  }

  /** Les verres d'un groupe, de bas en haut, par le rayon qu'on leur a donné. */
  stackOf(container: FakeView): number[] {
    return (container.children[0]?.children ?? []).map((glass) => glass.radius);
  }
}

/** Des minuteurs qu'on déclenche à la main. */
export function manualTimers() {
  const pending = new Map<number, () => void>();
  let next = 0;
  return {
    set: (callback: () => void, _ms: number): ReturnType<typeof setTimeout> => {
      next += 1;
      pending.set(next, callback);
      return next as unknown as ReturnType<typeof setTimeout>;
    },
    clear: (timer: ReturnType<typeof setTimeout>): void => {
      pending.delete(timer as unknown as number);
    },
    runAll: (): void => {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback();
    },
    size: (): number => pending.size,
  };
}
