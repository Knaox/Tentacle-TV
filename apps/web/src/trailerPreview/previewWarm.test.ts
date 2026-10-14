/**
 * Les titres à l'écran partent au serveur pour la préparation de leur aperçu :
 * quand la page se pose, les derniers apparus d'abord, sans doublon, deux
 * fois au plus en dix minutes (la seconde cinq secondes plus tard), jamais
 * un titre dont l'aperçu est déjà en cache, et rien sans envoi branché.
 * L'observateur de visibilité est factice ; le temps aussi.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trailerPreviewSubjectKey, type TrailerPreviewSubject } from "@tentacle-tv/shared";
import { PREVIEW_WARM_TIMING as T, resetPreviewWarm, setPreviewWarmSender, trackPreviewWarm } from "./previewWarm";

class FakeObserver {
  static current: FakeObserver | null = null;
  readonly observed = new Set<Element>();
  constructor(private readonly callback: (entries: IntersectionObserverEntry[]) => void) {
    FakeObserver.current = this;
  }
  observe(element: Element) {
    this.observed.add(element);
  }
  unobserve(element: Element) {
    this.observed.delete(element);
  }
  disconnect() {
    this.observed.clear();
  }
  /** Le navigateur dit qui est visible. */
  show(elements: Element[], visible = true) {
    this.callback(elements.map((target) => ({ target, isIntersecting: visible }) as IntersectionObserverEntry));
  }
}

const movie = (tmdbId: number): TrailerPreviewSubject => ({ kind: "tmdb", tmdbId, mediaType: "movie" });
const card = () => ({}) as Element;

let sends: string[][];
let ready: Set<string>;
let answer: boolean;

function plugSender() {
  return setPreviewWarmSender({
    send: async (subjects) => {
      sends.push(subjects.map(trailerPreviewSubjectKey));
      return answer;
    },
    isReady: (subject) => ready.has(trailerPreviewSubjectKey(subject)),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  resetPreviewWarm();
  sends = [];
  ready = new Set();
  answer = true;
});
afterEach(() => {
  resetPreviewWarm();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("préparation des aperçus › les titres à l'écran", () => {
  it("partent quand la page se pose, les derniers apparus d'abord, un titre une fois", async () => {
    plugSender();
    const [a, b, c] = [card(), card(), card()];
    trackPreviewWarm(a, movie(1));
    trackPreviewWarm(b, movie(2));
    trackPreviewWarm(c, movie(1));
    FakeObserver.current!.show([a]);
    await vi.advanceTimersByTimeAsync(100);
    FakeObserver.current!.show([b, c]);
    await vi.advanceTimersByTimeAsync(T.settleMs - 1);
    expect(sends).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(sends).toEqual([["tmdb:movie:2", "tmdb:movie:1"]]);
  });

  it("rien sans envoi branché ; branché, ce qui est déjà visible part", async () => {
    const a = card();
    trackPreviewWarm(a, movie(1));
    FakeObserver.current!.show([a]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(sends).toEqual([]);
    plugSender();
    await vi.advanceTimersByTimeAsync(T.settleMs);
    expect(sends).toEqual([["tmdb:movie:1"]]);
  });

  it("un second envoi cinq secondes plus tard s'il n'est pas prêt, puis plus rien pendant dix minutes", async () => {
    plugSender();
    const a = card();
    const b = card();
    trackPreviewWarm(a, movie(1));
    trackPreviewWarm(b, movie(2));
    FakeObserver.current!.show([a, b]);
    await vi.advanceTimersByTimeAsync(T.settleMs);
    // Le serveur a préparé le 2 entre-temps : il est en cache, il ne repart pas.
    ready.add("tmdb:movie:2");
    await vi.advanceTimersByTimeAsync(T.followUpMs);
    expect(sends).toEqual([["tmdb:movie:1", "tmdb:movie:2"], ["tmdb:movie:1"]]);
    await vi.advanceTimersByTimeAsync(T.windowMs - T.followUpMs - 1_000);
    expect(sends).toHaveLength(2);
  });

  it("une carte quittée ne part plus ; un envoi en panne fait attendre", async () => {
    plugSender();
    const a = card();
    const untrack = trackPreviewWarm(a, movie(1));
    FakeObserver.current!.show([a]);
    untrack();
    await vi.advanceTimersByTimeAsync(T.settleMs);
    expect(sends).toEqual([]);

    answer = false;
    const b = card();
    trackPreviewWarm(b, movie(2));
    FakeObserver.current!.show([b]);
    await vi.advanceTimersByTimeAsync(T.settleMs);
    const c = card();
    trackPreviewWarm(c, movie(3));
    FakeObserver.current!.show([c]);
    await vi.advanceTimersByTimeAsync(T.backoffMs - 1_000);
    expect(sends).toEqual([["tmdb:movie:2"]]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sends[1]).toEqual(["tmdb:movie:3", "tmdb:movie:2"]);
  });

  it("une carte apparue pendant un envoi part dès qu'il a répondu, sans attendre le second regard", async () => {
    let release!: () => void;
    setPreviewWarmSender({
      send: (subjects) => new Promise<boolean>((resolve) => {
        sends.push(subjects.map(trailerPreviewSubjectKey));
        release = () => resolve(true);
      }),
      isReady: () => false,
    });
    const [a, b] = [card(), card()];
    trackPreviewWarm(a, movie(1));
    trackPreviewWarm(b, movie(2));
    FakeObserver.current!.show([a]);
    await vi.advanceTimersByTimeAsync(T.settleMs);
    FakeObserver.current!.show([b]);
    await vi.advanceTimersByTimeAsync(T.settleMs);
    release();
    await vi.advanceTimersByTimeAsync(T.settleMs);
    expect(sends).toEqual([["tmdb:movie:1"], ["tmdb:movie:2"]]);
  });

  it("quarante titres par envoi ; le reste au suivant", async () => {
    plugSender();
    const cards = Array.from({ length: 45 }, (_, i) => {
      const element = card();
      trackPreviewWarm(element, movie(i + 1));
      return element;
    });
    FakeObserver.current!.show(cards);
    await vi.advanceTimersByTimeAsync(T.settleMs);
    await vi.advanceTimersByTimeAsync(T.settleMs);
    expect(sends.map((batch) => batch.length)).toEqual([40, 5]);
  });

  it("débranché (aperçus coupés, page cachée), plus rien ne part", async () => {
    const release = plugSender();
    const a = card();
    trackPreviewWarm(a, movie(1));
    release();
    FakeObserver.current!.show([a]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sends).toEqual([]);
  });
});
