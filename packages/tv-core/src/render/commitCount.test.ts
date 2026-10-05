import { describe, expect, it } from "vitest";
import { countCommit, type FiberLike } from "./commitCount";

const FUNCTION = 0;
const HOST = 5;
const TEXT = 6;
const MEMO = 15;

/** Une fibre et ses enfants, chaînés comme React les chaîne. */
function fiber(tag: number, flags = 0, children: FiberLike[] = []): FiberLike {
  const node: FiberLike = { tag, flags, child: children[0] ?? null, sibling: null, alternate: null };
  children.forEach((child, i) => {
    child.sibling = children[i + 1] ?? null;
  });
  return node;
}

/** La version suivante d'une fibre (son « alternate » pointe sur l'ancienne). */
function next(prev: FiberLike, flags: number, children: FiberLike[] | "same"): FiberLike {
  const node = fiber(prev.tag, flags, children === "same" ? [] : children);
  if (children === "same") node.child = prev.child;
  node.alternate = prev;
  prev.alternate = node;
  return node;
}

describe("le coût d'une validation React", () => {
  it("compte tout un arbre au premier rendu", () => {
    const root = fiber(3, 0, [fiber(FUNCTION, 1, [fiber(HOST, 0, [fiber(TEXT)]), fiber(MEMO, 1, [fiber(HOST)])])]);
    expect(countCommit(root, null)).toEqual({ components: 2, hostMounts: 3, hostUpdates: 0 });
  });

  it("ne visite pas un sous-arbre dont l'enfant n'a pas changé", () => {
    const deep = fiber(FUNCTION, 1, [fiber(HOST, 4)]);
    const rowPrev = fiber(MEMO, 0, [deep]);
    const rootPrev = fiber(3, 0, [rowPrev]);
    // La rangée a été clonée sans rendre (aucun « PerformedWork »), ses enfants laissés tels quels.
    const rowNext = next(rowPrev, 0, "same");
    const rootNext = next(rootPrev, 0, [rowNext]);
    expect(countCommit(rootNext, rootPrev)).toEqual({ components: 0, hostMounts: 0, hostUpdates: 0 });
  });

  it("compte ce qui a rendu, ce qui naît et ce qui change", () => {
    const keptHost = fiber(HOST);
    const cardPrev = fiber(FUNCTION, 0, [keptHost]);
    const rootPrev = fiber(3, 0, [cardPrev]);
    // La carte rend : sa vue change de props, l'habit du focus naît (un composant, deux vues).
    const dressing = fiber(MEMO, 1, [fiber(HOST), fiber(HOST)]);
    const hostNext = next(keptHost, 4, []);
    const cardNext = next(cardPrev, 1, [hostNext, dressing]);
    const rootNext = next(rootPrev, 0, [cardNext]);
    expect(countCommit(rootNext, rootPrev)).toEqual({ components: 2, hostMounts: 2, hostUpdates: 1 });
  });
});
