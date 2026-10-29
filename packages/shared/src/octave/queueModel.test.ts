import { describe, expect, it } from "vitest";
import { fixedRandom, libraryTrack } from "./fixtures";
import {
  advance,
  createQueue,
  currentItem,
  cycleRepeat,
  enqueue,
  extendWith,
  followWith,
  jumpTo,
  moveUpcoming,
  peekNext,
  playNext,
  previous,
  removeItem,
  replaceTrack,
  setShuffle,
  upcoming,
} from "./queueModel";

const tracks = ["a", "b", "c", "d"].map((id) => libraryTrack(id));
const keys = (items: readonly { track: { key: string } }[]) => items.map((i) => i.track.key);

describe("file Octave — ordre", () => {
  it("part du titre cliqué et avance dans l'ordre du contexte", () => {
    const q = createQueue(tracks, 1, { contextId: "album:1" });
    expect(currentItem(q)?.track.key).toBe("jf:b");
    expect(keys(upcoming(q))).toEqual(["jf:c", "jf:d"]);
    const q2 = advance(q, true);
    expect(q2 && currentItem(q2)?.track.key).toBe("jf:c");
  });

  it("s'arrête à la fin sans répétition, reboucle avec « tout répéter »", () => {
    const end = createQueue(tracks, 3);
    expect(advance(end, true)).toBeNull();
    expect(peekNext(end, true)).toBeNull();
    const loop = { ...end, repeat: "all" as const };
    expect(peekNext(loop, true)?.track.key).toBe("jf:a");
    expect(currentItem(advance(loop, true)!)?.track.key).toBe("jf:a");
  });

  it("« répéter le titre » rejoue en fin naturelle, mais « Suivant » avance", () => {
    const q = { ...createQueue(tracks, 0), repeat: "one" as const };
    expect(peekNext(q, true)?.track.key).toBe("jf:a");
    expect(currentItem(advance(q, true)!)?.track.key).toBe("jf:a");
    expect(currentItem(advance(q, false)!)?.track.key).toBe("jf:b");
  });

  it("« Précédent » revient au début après 3 s, sinon au titre d'avant", () => {
    const q = createQueue(tracks, 2);
    expect(previous(q, 5_000)).toEqual({ kind: "restart" });
    const back = previous(q, 1_000);
    expect(back.kind === "moved" && currentItem(back.queue)?.track.key).toBe("jf:b");
    expect(previous(createQueue(tracks, 0), 0)).toEqual({ kind: "restart" });
  });

  it("le cycle de répétition : off → tout → titre → off", () => {
    expect(cycleRepeat("off")).toBe("all");
    expect(cycleRepeat("all")).toBe("one");
    expect(cycleRepeat("one")).toBe("off");
  });
});

describe("file Octave — aléatoire", () => {
  it("à la création, le titre cliqué d'abord", () => {
    const q = createQueue(tracks, 2, { shuffle: true, random: fixedRandom([0.1, 0.9, 0.5]) });
    expect(currentItem(q)?.track.key).toBe("jf:c");
    expect(q.items).toHaveLength(4);
    expect(new Set(keys(q.items)).size).toBe(4);
  });

  it("allumé en cours : l'historique et le courant restent, la suite est battue ; éteint : l'ordre revient", () => {
    const q = createQueue(tracks, 1);
    const on = setShuffle(q, true, fixedRandom([0]));
    expect(keys(on.items.slice(0, 2))).toEqual(["jf:a", "jf:b"]);
    expect(currentItem(on)?.track.key).toBe("jf:b");
    expect(new Set(keys(upcoming(on)))).toEqual(new Set(["jf:c", "jf:d"]));
    const off = setShuffle(on, false);
    expect(keys(off.items)).toEqual(["jf:a", "jf:b", "jf:c", "jf:d"]);
    expect(currentItem(off)?.track.key).toBe("jf:b");
  });
});

describe("file Octave — gestes", () => {
  it("« Lire ensuite » se pose juste après le courant, « Ajouter » avant la suite du contexte", () => {
    const q = createQueue(tracks, 0);
    const x = libraryTrack("x");
    expect(keys(upcoming(playNext(q, [x])))[0]).toBe("jf:x");
    expect(keys(upcoming(enqueue(q, [x])))[0]).toBe("jf:x");
    const fresh = enqueue(createQueue([], 0), [x]);
    expect(currentItem(fresh)?.track.key).toBe("jf:x");
  });

  it("retire, déplace et saute par uid (doublons possibles)", () => {
    const q = enqueue(createQueue(tracks, 0), [libraryTrack("a")]);
    const dupe = q.items[1]!;
    expect(keys(removeItem(q, dupe.uid).items)).toEqual(["jf:a", "jf:b", "jf:c", "jf:d"]);
    expect(removeItem(q, q.items[0]!.uid)).toBe(q);
    // La file d'attente (le doublon) reste devant ; dans la suite du contexte, « d » passe en tête.
    const moved = moveUpcoming(q, q.items[4]!.uid, 0);
    expect(keys(upcoming(moved))).toEqual(["jf:a", "jf:d", "jf:b", "jf:c"]);
    expect(currentItem(jumpTo(q, dupe.uid))?.uid).toBe(dupe.uid);
  });

  it("un titre résolu remplace toutes ses entrées, à la même place", () => {
    const q = createQueue(tracks, 0);
    const resolved = libraryTrack("b2");
    const next = replaceTrack(q, (t) => t.key === "jf:b", resolved);
    expect(keys(next.items)).toEqual(["jf:a", "jf:b2", "jf:c", "jf:d"]);
    expect(next.items[1]!.uid).toBe(q.items[1]!.uid);
  });
});

describe("la suite d'un titre (S3 : la radio après un clic de recherche)", () => {
  const list = ["a", "b", "c", "d"].map((id) => libraryTrack(id));
  const radio = ["b", "x", "y"].map((id) => libraryTrack(id));

  it("tout ce qui suivait le titre est remplacé, l'historique reste, le titre lui-même n'est pas repris", () => {
    const q = createQueue(list, 1, { contextId: "search:q" });
    const current = currentItem(q)!;
    const next = followWith(q, current.uid, radio, "radio:jf:b");
    expect(next.items.map((i) => i.track.key)).toEqual(["jf:a", "jf:b", "jf:x", "jf:y"]);
    expect(currentItem(next)?.uid).toBe(current.uid);
    expect(next.contextId).toBe("radio:jf:b");
  });

  it("sans effet si l'utilisateur est passé à un autre titre, ou si la suite est vide", () => {
    const q = createQueue(list, 1, { contextId: "search:q" });
    expect(followWith(q, "autre", radio, "radio:x")).toBe(q);
    expect(followWith(q, currentItem(q)!.uid, [libraryTrack("b")], "radio:x")).toBe(q);
  });
});

describe("la radio sans fin (G3) : la page suivante au bout de la file", () => {
  const list = ["a", "b", "c"].map((id) => libraryTrack(id));

  it("s'ajoute au bout, sans ce que la file porte déjà (écouté, courant, à venir) ni un titre redit dans la page", () => {
    const q = createQueue(list, 1, { contextId: "radio:jf:a" });
    const page = ["a", "b", "c", "x", "x", "y"].map((id) => libraryTrack(id));
    const next = extendWith(q, "radio:jf:a", page);
    expect(keys(next.items)).toEqual(["jf:a", "jf:b", "jf:c", "jf:x", "jf:y"]);
    expect(currentItem(next)?.uid).toBe(currentItem(q)?.uid);
    expect(next.original).toEqual(next.items.map((i) => i.uid));
  });

  it("sans effet si la file n'est plus celle de cette radio, ou si la page ne dit rien de nouveau", () => {
    const q = createQueue(list, 0, { contextId: "album:1" });
    expect(extendWith(q, "radio:jf:a", [libraryTrack("x")])).toBe(q);
    const radio = createQueue(list, 0, { contextId: "radio:jf:a" });
    expect(extendWith(radio, "radio:jf:a", list)).toBe(radio);
  });
});
