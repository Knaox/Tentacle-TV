import { describe, expect, it } from "vitest";
import { fixedRandom, libraryTrack } from "./fixtures";
import {
  advance,
  carryUserQueue,
  clearUserQueue,
  createQueue,
  currentItem,
  enqueue,
  followWith,
  isUserEntry,
  jumpTo,
  moveUpcoming,
  peekNext,
  playNext,
  previous,
  queueSections,
  removeItem,
  setShuffle,
  upcoming,
  type QueueItem,
  type QueueState,
} from "./queueModel";
import { revivePlayback, savePlayback } from "./octaveResume";
import { INITIAL_SNAPSHOT } from "./playerState";

const t = (id: string) => libraryTrack(id);
const keys = (items: readonly QueueItem[]) => items.map((i) => i.track.key.slice(3));
const album = () => createQueue(["a", "b", "c", "d"].map(t), 0, { contextId: "album:1" });
const sections = (q: QueueState) => {
  const s = queueSections(q);
  return { current: s.current?.track.key.slice(3) ?? null, user: keys(s.userQueue), context: keys(s.contextQueue) };
};

describe("deux files — « Ajouter à la file d'attente »", () => {
  it("crée la file d'attente, qui passe AVANT la suite de l'album", () => {
    const q = enqueue(album(), [t("x")]);
    expect(sections(q)).toEqual({ current: "a", user: ["x"], context: ["b", "c", "d"] });
    expect(isUserEntry(q, q.items[1]!.uid)).toBe(true);
    expect(isUserEntry(q, q.items[2]!.uid)).toBe(false);
  });

  it("plusieurs ajouts se suivent dans l'ordre demandé, toujours avant le contexte", () => {
    const q = enqueue(enqueue(album(), [t("x")]), [t("y"), t("z")]);
    expect(sections(q)).toEqual({ current: "a", user: ["x", "y", "z"], context: ["b", "c", "d"] });
  });

  it("sans rien en cours, le titre ajouté se lit (il devient la file)", () => {
    const q = enqueue(createQueue([], 0), [t("x")]);
    expect(sections(q)).toEqual({ current: "x", user: [], context: [] });
  });
});

describe("deux files — « Lire ensuite »", () => {
  it("se pose en tête de la file d'attente", () => {
    const q = playNext(enqueue(album(), [t("x")]), [t("n")]);
    expect(sections(q)).toEqual({ current: "a", user: ["n", "x"], context: ["b", "c", "d"] });
  });

  it("plusieurs « Lire ensuite » : le DERNIER passe en tête", () => {
    const q = playNext(playNext(playNext(album(), [t("n1")]), [t("n2")]), [t("n3")]);
    expect(sections(q).user).toEqual(["n3", "n2", "n1"]);
  });

  it("un même geste sur plusieurs titres (un album) garde leur ordre", () => {
    const q = playNext(playNext(album(), [t("n1")]), [t("p"), t("q")]);
    expect(sections(q).user).toEqual(["p", "q", "n1"]);
  });

  it("« Ajouter » après des « Lire ensuite » se range au bout de la file d'attente", () => {
    const q = enqueue(playNext(album(), [t("n")]), [t("x")]);
    expect(sections(q)).toEqual({ current: "a", user: ["n", "x"], context: ["b", "c", "d"] });
  });
});

describe("deux files — la lecture", () => {
  it("la file d'attente se lit, puis la suite de l'album reprend où elle était", () => {
    let q: QueueState | null = enqueue(album(), [t("x"), t("y")]);
    const order: string[] = [];
    while (q) {
      order.push(currentItem(q)!.track.key.slice(3));
      q = advance(q, true);
    }
    expect(order).toEqual(["a", "x", "y", "b", "c", "d"]);
  });

  it("un ajout PENDANT la file d'attente passe encore avant l'album", () => {
    const q = advance(enqueue(album(), [t("x")]), true)!;
    expect(sections(q).current).toBe("x");
    expect(sections(enqueue(q, [t("y")]))).toEqual({ current: "x", user: ["y"], context: ["b", "c", "d"] });
  });

  it("« Précédent » : la file d'attente reste devant la suite du contexte", () => {
    const q = advance(enqueue(album(), [t("x")]), true)!; // x en cours
    const played = advance(q, true)!; // b en cours, x lu
    const withQueue = enqueue(played, [t("y")]);
    const back = previous(withQueue, 0);
    expect(back.kind).toBe("moved");
    if (back.kind === "moved") expect(sections(back.queue)).toEqual({ current: "x", user: ["y"], context: ["b", "c", "d"] });
  });

  it("« Tout répéter » reboucle sur l'album seul : la file d'attente se lit une fois", () => {
    let q: QueueState = { ...enqueue(createQueue(["a", "b"].map(t), 1), [t("x")]), repeat: "all" };
    q = advance(q, true)!; // x
    expect(peekNext(q, true)?.track.key).toBe("jf:a");
    const looped = advance(q, true)!;
    expect(keys(looped.items)).toEqual(["a", "b"]);
    expect(sections(looped).current).toBe("a");
  });

  it("une file faite de la seule file d'attente reboucle entière", () => {
    const q = { ...enqueue(createQueue([], 0), [t("x")]), repeat: "all" as const };
    expect(sections(advance(q, true)!).current).toBe("x");
  });
});

describe("deux files — gestes dans la file", () => {
  it("sauter dans la suite de l'album ne jette pas la file d'attente : elle se lit juste après", () => {
    const q = enqueue(album(), [t("x")]);
    const target = q.items.find((i) => i.track.key === "jf:c")!;
    const jumped = jumpTo(q, target.uid);
    expect(sections(jumped)).toEqual({ current: "c", user: ["x"], context: ["d"] });
    expect(keys(jumped.items.slice(0, jumped.cursor))).toEqual(["a", "b"]);
  });

  it("sauter dans la file d'attente garde ce qu'elle avait devant, juste après", () => {
    const q = enqueue(album(), [t("x"), t("y"), t("z")]);
    const jumped = jumpTo(q, q.items[3]!.uid); // z
    expect(sections(jumped)).toEqual({ current: "z", user: ["x", "y"], context: ["b", "c", "d"] });
  });

  it("une entrée ne se déplace que dans SA file", () => {
    const q = enqueue(album(), [t("x"), t("y")]);
    const y = q.items[2]!;
    expect(sections(moveUpcoming(q, y.uid, 0)).user).toEqual(["y", "x"]);
    expect(sections(moveUpcoming(q, y.uid, 99)).user).toEqual(["x", "y"]);
    const d = q.items.find((i) => i.track.key === "jf:d")!;
    expect(sections(moveUpcoming(q, d.uid, 0))).toEqual({ current: "a", user: ["x", "y"], context: ["d", "b", "c"] });
    expect(moveUpcoming(q, q.items[0]!.uid, 1)).toBe(q); // le courant ne bouge pas
  });

  it("retirer et effacer : la suite de l'album reprend juste après le courant", () => {
    const q = enqueue(album(), [t("x"), t("y")]);
    expect(sections(removeItem(q, q.items[1]!.uid)).user).toEqual(["y"]);
    expect(sections(clearUserQueue(q))).toEqual({ current: "a", user: [], context: ["b", "c", "d"] });
    const plain = album();
    expect(clearUserQueue(plain)).toBe(plain);
  });
});

describe("deux files — aléatoire", () => {
  it("allumé, seule la suite du contexte est battue : la file d'attente reste devant, dans son ordre", () => {
    const q = enqueue(album(), [t("x"), t("y")]);
    const on = setShuffle(q, true, fixedRandom([0, 0, 0]));
    expect(sections(on).user).toEqual(["x", "y"]);
    expect(new Set(sections(on).context)).toEqual(new Set(["b", "c", "d"]));
  });

  it("éteint, le contexte reprend son ordre au titre en cours, la file d'attente devant", () => {
    const shuffledQ = createQueue(["a", "b", "c", "d"].map(t), 2, { shuffle: true, random: fixedRandom([0, 0, 0]) });
    const q = enqueue(shuffledQ, [t("x")]);
    const off = setShuffle(q, false);
    expect(sections(off)).toEqual({ current: "c", user: ["x"], context: ["d"] });
    expect(keys(off.items.slice(0, off.cursor))).toEqual(["a", "b"]);
  });

  it("éteint pendant la file d'attente : le contexte reprend après le dernier titre de l'album lu", () => {
    const q = advance(enqueue(createQueue(["a", "b", "c", "d"].map(t), 1), [t("x"), t("y")]), true)!; // x en cours
    const on = setShuffle(q, true, fixedRandom([0.5, 0.5]));
    const off = setShuffle(on, false);
    expect(sections(off)).toEqual({ current: "x", user: ["y"], context: ["c", "d"] });
  });
});

describe("deux files — un nouveau contexte, la radio, la reprise", () => {
  it("lancer un autre album garde la file d'attente, devant sa suite", () => {
    const q = enqueue(album(), [t("x")]);
    const next = carryUserQueue(q, createQueue(["m", "n", "o"].map(t), 1, { contextId: "album:2" }));
    expect(sections(next)).toEqual({ current: "n", user: ["x"], context: ["o"] });
    expect(next.contextId).toBe("album:2");
  });

  it("la radio d'un titre remplace la suite du contexte, pas la file d'attente", () => {
    const q = enqueue(createQueue(["a", "b"].map(t), 0, { contextId: "search:q" }), [t("x")]);
    const radio = followWith(q, q.items[0]!.uid, ["r1", "r2"].map(t), "radio:a");
    expect(sections(radio)).toEqual({ current: "a", user: ["x"], context: ["r1", "r2"] });
  });

  it("l'app relancée retrouve les deux files (hors ligne compris : rien n'est relu du serveur)", () => {
    const q = playNext(enqueue(album(), [t("x")]), [t("n")]);
    const saved = savePlayback({ ...INITIAL_SNAPSHOT, queue: q, current: currentItem(q)!.track }, 0)!;
    const revived = revivePlayback(JSON.parse(JSON.stringify(saved)))!;
    expect(sections(revived.queue)).toEqual({ current: "a", user: ["n", "x"], context: ["b", "c", "d"] });
  });

  it("upcoming() rend toujours l'ordre réel de lecture : la file d'attente, puis le contexte", () => {
    const q = playNext(enqueue(album(), [t("x")]), [t("n")]);
    expect(keys(upcoming(q))).toEqual(["n", "x", "b", "c", "d"]);
  });
});
