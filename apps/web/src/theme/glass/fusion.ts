/**
 * Fusion de verres voisins — l'équivalent de `GlassEffectContainer`, pur.
 *
 * Dans SwiftUI, deux formes de verre d'un même conteneur qui s'approchent à
 * moins de `spacing` se rejoignent en UNE forme ; elles se séparent en
 * s'éloignant. Ici, chaque membre garde SA couche de verre (une clé stable,
 * donc une animation continue), et la règle dit, pour chacun :
 *  - le rectangle à couvrir : le sien seul, ou l'enveloppe de son groupe ;
 *  - s'il est visible : dans un groupe, un SEUL membre dessine l'enveloppe —
 *    deux verres translucides superposés doubleraient la teinte.
 *
 * L'animation n'est alors que des `transform` et des `opacity` : au moment où
 * deux capsules fusionnent, la première s'étire jusqu'à l'enveloppe pendant
 * que la seconde s'y étire en s'effaçant — on voit les deux gouttes se
 * rejoindre ; à la séparation, l'inverse.
 */

export interface GlassRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FusionMember {
  id: string;
  rect: GlassRect;
}

export interface FusionShape {
  id: string;
  rect: GlassRect;
  /** Faux : couche gardée montée (pour l'animation), mais transparente. */
  visible: boolean;
  /** Identifiant du groupe (celui de son premier membre). */
  group: string;
}

/** Plus petite distance entre deux rectangles (0 s'ils se touchent ou se chevauchent). */
export function rectGap(a: GlassRect, b: GlassRect): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
  return Math.hypot(dx, dy);
}

export function unionRect(rects: GlassRect[]): GlassRect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Groupes par proximité, transitive (A près de B, B près de C : un seul
 * groupe). L'ordre des membres est gardé : le premier d'un groupe en est le
 * porteur, ce qui rend le résultat stable d'une mesure à l'autre.
 */
export function fusionGroups(members: FusionMember[], spacing: number): FusionMember[][] {
  const parent = members.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      if (rectGap(members[i].rect, members[j].rect) <= spacing) {
        const a = find(i);
        const b = find(j);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
      }
    }
  }
  const groups = new Map<number, FusionMember[]>();
  members.forEach((m, i) => {
    const root = find(i);
    const g = groups.get(root) ?? [];
    g.push(m);
    groups.set(root, g);
  });
  return [...groups.values()];
}

/** La forme que dessine chaque membre. `spacing` ≤ 0 : aucune fusion. */
export function fusionLayout(members: FusionMember[], spacing: number): FusionShape[] {
  if (spacing <= 0) {
    return members.map((m) => ({ id: m.id, rect: m.rect, visible: true, group: m.id }));
  }
  const shapes = new Map<string, FusionShape>();
  for (const group of fusionGroups(members, spacing)) {
    const rect = group.length === 1 ? group[0].rect : unionRect(group.map((m) => m.rect));
    group.forEach((m, i) => shapes.set(m.id, { id: m.id, rect, visible: i === 0, group: group[0].id }));
  }
  return members.map((m) => shapes.get(m.id) as FusionShape);
}

/**
 * Transformation qui fait paraître un rectangle `to` à la place de `from`
 * (technique FLIP) : on pose l'élément à sa place finale, on lui applique
 * celle-ci, puis on la ramène à l'identité — l'animation est un `transform`.
 * Origine de la transformation : coin haut-gauche.
 */
export function flipTransform(from: GlassRect, to: GlassRect): { x: number; y: number; scaleX: number; scaleY: number } {
  return {
    x: from.x - to.x,
    y: from.y - to.y,
    scaleX: to.width > 0 ? from.width / to.width : 1,
    scaleY: to.height > 0 ? from.height / to.height : 1,
  };
}

/**
 * Rayon à poser pendant une mise à l'échelle non uniforme pour que les coins
 * PARAISSENT garder `radius` : rx = r / sx, ry = r / sy (rayon elliptique).
 * C'est la correction que framer-motion applique à ses animations `layout`.
 */
export function correctedRadius(radius: number, scaleX: number, scaleY: number): string {
  const rx = scaleX > 0 ? radius / scaleX : radius;
  const ry = scaleY > 0 ? radius / scaleY : radius;
  const r = (n: number) => Math.round(n * 100) / 100;
  return `${r(rx)}px / ${r(ry)}px`;
}
