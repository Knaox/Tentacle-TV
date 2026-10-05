/**
 * Ce qu'une VALIDATION de React (un « commit ») a coûté : combien de
 * composants se sont rendus, combien de vues natives sont nées, combien ont
 * reçu de nouvelles props — la mesure, indépendante de la vitesse de
 * l'appareil, de ce qu'un pas du focus fait travailler.
 *
 * Lu dans l'arbre des fibres que React donne au crochet des outils de
 * développement (`onCommitFiberRoot`), à la manière de React DevTools : un
 * sous-arbre dont l'enfant n'a pas changé n'a pas été visité par React — on
 * ne le visite pas non plus ; une fibre sans version précédente vient de
 * naître (tout son sous-arbre aussi). Le mode de mesure d'Android TV s'en sert
 * (`apps/tv/src/platform/perf`), même dans une build de production : React y
 * appelle le crochet s'il existe.
 *
 * Module pur : des objets, aucune importation de React.
 */

/** Ce que l'on lit d'une fibre — les champs internes de React, stables depuis React 16. */
export interface FiberLike {
  tag: number;
  flags: number;
  child: FiberLike | null;
  sibling: FiberLike | null;
  alternate: FiberLike | null;
}

export interface CommitCount {
  /** Composants (fonctions, classes, `memo`, `forwardRef`) rendus. */
  components: number;
  /** Vues natives (et textes) créées. */
  hostMounts: number;
  /** Vues natives existantes dont les props ont changé. */
  hostUpdates: number;
}

/** FunctionComponent, ClassComponent, ForwardRef, MemoComponent, SimpleMemoComponent. */
const COMPONENT_TAGS: ReadonlySet<number> = new Set([0, 1, 11, 14, 15]);
/** HostComponent, HostText. */
const HOST_TAGS: ReadonlySet<number> = new Set([5, 6]);
/** `PerformedWork` : la fibre a rendu pendant ce passage. */
const PERFORMED_WORK = 1;
/** `Update` : une vue native à mettre à jour. */
const UPDATE = 4;

export const emptyCommitCount = (): CommitCount => ({ components: 0, hostMounts: 0, hostUpdates: 0 });

/** Un sous-arbre qui vient de naître : tout y compte. */
function countMount(fiber: FiberLike, count: CommitCount): void {
  const stack: FiberLike[] = [fiber];
  while (stack.length > 0) {
    const node = stack.pop() as FiberLike;
    if (COMPONENT_TAGS.has(node.tag)) count.components++;
    else if (HOST_TAGS.has(node.tag)) count.hostMounts++;
    for (let child = node.child; child; child = child.sibling) stack.push(child);
  }
}

/**
 * Le coût du commit dont `current` est la racine validée (`root.current`) ;
 * `previous` : la racine d'avant (`current.alternate`), `null` au premier
 * rendu.
 */
export function countCommit(current: FiberLike, previous: FiberLike | null): CommitCount {
  const count = emptyCommitCount();
  if (!previous) {
    countMount(current, count);
    return count;
  }
  const stack: [FiberLike, FiberLike][] = [[current, previous]];
  while (stack.length > 0) {
    const [next, prev] = stack.pop() as [FiberLike, FiberLike];
    if (COMPONENT_TAGS.has(next.tag)) {
      if ((next.flags & PERFORMED_WORK) !== 0) count.components++;
    } else if (HOST_TAGS.has(next.tag) && (next.flags & UPDATE) !== 0) {
      count.hostUpdates++;
    }
    // Le même enfant : React n'est pas descendu ici.
    if (next.child === prev.child) continue;
    for (let child = next.child; child; child = child.sibling) {
      if (child.alternate) stack.push([child, child.alternate]);
      else countMount(child, count);
    }
  }
  return count;
}
