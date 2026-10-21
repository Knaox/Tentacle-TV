/**
 * La SCÈNE du verre d'une fenêtre : la racine posée sous le compositeur de
 * Chromium, et un `NSGlassEffectContainerView` par groupe.
 *
 * Les verres d'un même conteneur sont rendus ensemble (« par lots », dit AppKit)
 * et FUSIONNENT quand ils s'approchent à moins de `spacing` points — le
 * « liquide » du Liquid Glass. Un groupe par famille de surfaces (les capsules
 * du lecteur, par exemple), le groupe par défaut sinon, à `spacing` nul : rendu
 * groupé, aucune fusion.
 *
 * Racine et conteneurs n'existent que tant qu'un verre vit dessous (`prune`).
 */

import type { GlassBackend, GroupHandle, ViewHandle } from "./backend";
import { stackAnchor } from "./geometry";

interface GroupEntry {
  readonly handle: GroupHandle;
  readonly seq: number;
  spacing: number;
}

export class GlassStage {
  private root: ViewHandle | null = null;
  private readonly groups = new Map<string, GroupEntry>();
  private surfaceVisible = true;
  private seq = 0;

  constructor(private readonly backend: GlassBackend) {}

  /** La vue de contenu du groupe, créée au besoin — `null` si la fenêtre refuse la racine. */
  content(key: string, spacing: number): ViewHandle | null {
    const known = this.groups.get(key);
    if (known !== undefined) return known.handle.content;
    const root = this.ensureRoot();
    if (root === null) return null;
    const group: GroupEntry = { handle: this.backend.createGroup(root, spacing), seq: (this.seq += 1), spacing };
    this.groups.set(key, group);
    return group.handle.content;
  }

  /**
   * Pose le conteneur d'un groupe parmi les autres : sous le premier dont la
   * profondeur (`topZ`) est plus grande. Sans cela, la profondeur demandée par
   * la page ne vaudrait qu'à l'intérieur d'un groupe.
   */
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

  /**
   * Surface de Chromium opaque : tout le verre est masqué, et serait pourtant
   * composé à chaque image. Caché, il ne coûte plus rien.
   */
  setSurfaceVisible(visible: boolean): void {
    this.surfaceVisible = visible;
    if (this.root !== null) this.backend.setHidden(this.root, !visible);
  }

  isSurfaceVisible(): boolean {
    return this.surfaceVisible;
  }

  /** Démolit les groupes que `used` ne réclame plus, puis la racine s'il n'en reste aucun. */
  prune(used: (key: string) => boolean): void {
    for (const [key, group] of this.groups) {
      if (used(key)) continue;
      this.backend.dispose(group.handle.container);
      this.groups.delete(key);
    }
    if (this.groups.size === 0 && this.root !== null) {
      this.backend.dispose(this.root);
      this.root = null;
    }
  }

  /** La fenêtre est détruite : rendre les références, sans un message à ses vues. */
  forget(): void {
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

  private ensureRoot(): ViewHandle | null {
    if (this.root !== null) return this.root;
    this.root = this.backend.createRoot();
    if (this.root !== null && !this.surfaceVisible) this.backend.setHidden(this.root, true);
    return this.root;
  }
}
