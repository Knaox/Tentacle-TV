/**
 * Les ARRIVÉES dans une rangée de cartes : quand la liste d'une rangée change
 * sous les yeux (un titre ajouté à la bibliothèque, annoncé par le serveur),
 * ce qui vient d'entrer et ce qui s'est décalé — de quoi le montrer au lieu
 * de tout redessiner. Module pur, le même pour toutes les plateformes.
 *
 * La clé d'une carte est l'identifiant de son titre, jamais sa position : une
 * clé par position faisait changer TOUTES les clés à la moindre insertion en
 * tête, et la rangée entière se remontait (affiches rechargées, éclair sans
 * image). Un titre présent deux fois (doublon de bibliothèque) reçoit `id~2`,
 * `id~3`… : les clés restent uniques et stables.
 */
export function rowItemKeys(ids: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return ids.map((id) => {
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    return n === 1 ? id : `${id}~${n}`;
  });
}

/** Ce qui a bougé d'une version de la rangée à la suivante. */
export interface RowShift {
  /** Les cartes qui n'étaient pas là. */
  arrived: ReadonlySet<string>;
  /** Les cartes restées, déplacées : clé → ancienne position − nouvelle. */
  moved: ReadonlyMap<string, number>;
}

const NOTHING: RowShift = { arrived: new Set(), moved: new Map() };

/**
 * Compare deux versions des clés d'une rangée. Rien sans version précédente,
 * ni depuis une rangée vide : sa première apparition a sa propre entrée (la
 * cascade), ce n'est pas une arrivée.
 */
export function rowShift(previous: readonly string[] | null, next: readonly string[]): RowShift {
  if (!previous || previous.length === 0) return NOTHING;
  const before = new Map(previous.map((key, index) => [key, index] as const));
  const arrived = new Set<string>();
  const moved = new Map<string, number>();
  next.forEach((key, index) => {
    const old = before.get(key);
    if (old === undefined) arrived.add(key);
    else if (old !== index) moved.set(key, old - index);
  });
  return arrived.size === 0 && moved.size === 0 ? NOTHING : { arrived, moved };
}
