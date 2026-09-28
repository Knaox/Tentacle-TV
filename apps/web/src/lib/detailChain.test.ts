import { describe, expect, it, vi } from "vitest";
import type { UNSAFE_createBrowserHistory } from "react-router-dom";
import { isDetailPath, replacesDetailEntry, withDetailChain } from "./detailChain";

type BrowserHistory = ReturnType<typeof UNSAFE_createBrowserHistory>;

/** Un historique en mémoire, réduit à ce que l'enveloppe consulte. */
function fakeHistory(initial: string) {
  const entries = [initial];
  let index = 0;
  const base = {
    get action() { return "POP"; },
    get location() { return { pathname: entries[index], search: "", hash: "", state: null, key: "k" }; },
    createHref: vi.fn(),
    createURL: vi.fn(),
    encodeLocation: vi.fn(),
    push: vi.fn((to: string) => { entries.splice(index + 1); entries.push(to); index += 1; }),
    replace: vi.fn((to: string) => { entries[index] = to; }),
    go: vi.fn((delta: number) => { index += delta; }),
    listen: vi.fn(() => () => {}),
  } as unknown as BrowserHistory;
  return { base, entries, current: () => entries[index] };
}

describe("isDetailPath", () => {
  it("reconnaît la fiche média et elle seule", () => {
    expect(isDetailPath("/media/abc")).toBe(true);
    expect(isDetailPath("/media/abc/")).toBe(true);
    expect(isDetailPath("/watch/abc")).toBe(false);
    expect(isDetailPath("/share/tok/abc")).toBe(false);
    expect(isDetailPath("/library/abc")).toBe(false);
    expect(isDetailPath("/")).toBe(false);
  });
});

describe("replacesDetailEntry", () => {
  it("remplace d'une fiche à une fiche, chaîne ou objet", () => {
    expect(replacesDetailEntry("/media/a", "/media/b")).toBe(true);
    expect(replacesDetailEntry("/media/a", { pathname: "/media/b", search: "?x=1" })).toBe(true);
  });

  it("empile tout le reste", () => {
    expect(replacesDetailEntry("/", "/media/b")).toBe(false);
    expect(replacesDetailEntry("/search", "/media/b")).toBe(false);
    expect(replacesDetailEntry("/media/a", "/watch/a")).toBe(false);
    expect(replacesDetailEntry("/media/a", "/library/x")).toBe(false);
  });

  it("un changement de requête seul reste sur la fiche", () => {
    expect(replacesDetailEntry("/media/a", { search: "?season=2" })).toBe(true);
  });
});

describe("withDetailChain", () => {
  it("un seul retour ramène à l'origine d'une chaîne de fiches", () => {
    const { base, entries, current } = fakeHistory("/library/films");
    const history = withDetailChain(base);
    history.push("/media/a");
    history.push("/media/b");
    history.push("/media/c");
    expect(entries).toEqual(["/library/films", "/media/c"]);
    history.go(-1);
    expect(current()).toBe("/library/films");
  });

  it("le lecteur s'empile au-dessus de la fiche", () => {
    const { base, entries } = fakeHistory("/");
    const history = withDetailChain(base);
    history.push("/media/a");
    history.push("/watch/a");
    expect(entries).toEqual(["/", "/media/a", "/watch/a"]);
  });

  it("fonctionne détaché, comme le routeur l'appelle", () => {
    const { base, entries } = fakeHistory("/media/a");
    const { push } = withDetailChain(base);
    push("/media/b", { from: "similar" });
    expect(base.replace).toHaveBeenCalledWith("/media/b", { from: "similar" });
    expect(entries).toEqual(["/media/b"]);
  });

  it("relit l'adresse courante à chaque appel", () => {
    const { base } = fakeHistory("/");
    const history = withDetailChain(base);
    expect(history.location.pathname).toBe("/");
    history.push("/media/a");
    expect(history.location.pathname).toBe("/media/a");
  });
});
