import { describe, expect, it } from "vitest";
import {
  ARRIVAL_RAIL_IS_USER_MS,
  closeArrival,
  closesArrival,
  contentKeyOf,
  entryClaim,
  lastContentAfter,
  preferEntry,
  returnClaim,
  startArrival,
} from "./screenEntry";
import { forYouEntryKey, homeEntryKey, rowCardKey } from "./homeEntry";

describe("screenEntry — l'arrivée sur un écran", () => {
  it("la préférence suit l'entrée pendant l'arrivée : l'ancienne la perd, la nouvelle la reçoit", () => {
    let arrival = startArrival(0);
    const first = preferEntry(arrival, null);
    expect(first.change).toBeNull();
    arrival = first.arrival;
    const loaded = preferEntry(arrival, "status:primary");
    expect(loaded.change).toEqual({ unprefer: null, prefer: "status:primary" });
    const hero = preferEntry(loaded.arrival, "hero:primary");
    expect(hero.change).toEqual({ unprefer: "status:primary", prefer: "hero:primary" });
    expect(preferEntry(hero.arrival, "hero:primary").change).toBeNull();
  });

  it("une entrée nulle retire la préférence sans en poser", () => {
    const withHero = preferEntry(startArrival(0), "hero:primary").arrival;
    expect(preferEntry(withHero, null).change).toEqual({ unprefer: "hero:primary", prefer: null });
  });

  it("l'entrée se réclame pendant l'arrivée seulement, et si elle existe", () => {
    const arrival = startArrival(0);
    expect(entryClaim(arrival, "hero:primary")).toBe("hero:primary");
    expect(entryClaim(arrival, null)).toBeNull();
    expect(entryClaim(closeArrival(arrival).arrival, "hero:primary")).toBeNull();
  });

  it("le premier focus de contenu clôt l'arrivée, tout de suite", () => {
    expect(closesArrival(startArrival(1_000), false, 1_001)).toBe(true);
  });

  it("la navigation ne la clôt qu'après 600 ms depuis le PREMIER rendu", () => {
    const arrival = startArrival(1_000);
    expect(ARRIVAL_RAIL_IS_USER_MS).toBe(600);
    expect(closesArrival(arrival, true, 1_600)).toBe(false);
    expect(closesArrival(arrival, true, 1_601)).toBe(true);
  });

  it("une arrivée close ne se clôt plus", () => {
    const closed = closeArrival(preferEntry(startArrival(0), "hero:primary").arrival);
    expect(closed.unprefer).toBe("hero:primary");
    expect(closesArrival(closed.arrival, false, 5)).toBe(false);
    expect(closeArrival(closed.arrival)).toEqual({ arrival: closed.arrival, unprefer: null });
    expect(preferEntry(closed.arrival, "resume:0").change).toBeNull();
  });

  it("seul un focus hors de la navigation devient la dernière clé de contenu", () => {
    expect(lastContentAfter(null, "hero:primary", false)).toBe("hero:primary");
    expect(lastContentAfter("hero:primary", "nav:Home", true)).toBe("hero:primary");
  });

  it("la clé de contenu : la dernière si elle est montée, sinon l'entrée", () => {
    const mounted = new Set(["resume:2"]);
    const isMounted = (key: string) => mounted.has(key);
    expect(contentKeyOf("resume:2", "hero:primary", isMounted)).toBe("resume:2");
    expect(contentKeyOf("resume:9", "hero:primary", isMounted)).toBe("hero:primary");
    expect(contentKeyOf(null, null, isMounted)).toBeNull();
  });

  it("le retour réclame la clé de contenu, jamais au premier passage", () => {
    expect(returnClaim(true, "resume:2")).toBeNull();
    expect(returnClaim(false, "resume:2")).toBe("resume:2");
    expect(returnClaim(false, null)).toBeNull();
  });
});

describe("homeEntry — l'entrée de l'accueil et de « Pour vous »", () => {
  const home = { failed: false, loading: false, empty: false, hasHero: true, firstRowKey: "resume" };

  it("l'accueil : erreur → Réessayer, chargement ou vide → rien, héros → Lire, sinon la 1re carte", () => {
    expect(homeEntryKey({ ...home, failed: true, loading: true })).toBe("status:primary");
    expect(homeEntryKey({ ...home, loading: true })).toBeNull();
    expect(homeEntryKey({ ...home, empty: true })).toBeNull();
    expect(homeEntryKey(home)).toBe("hero:primary");
    expect(homeEntryKey({ ...home, hasHero: false })).toBe("resume:0");
    expect(homeEntryKey({ ...home, hasHero: false, firstRowKey: null })).toBeNull();
  });

  it("« Pour vous » : panneau avec bouton → lui, sans bouton → rien, tête → Lire, sinon la 1re carte", () => {
    const forYou = { status: null, hasHero: true, firstShelfKey: "shelf:a" };
    expect(forYouEntryKey({ ...forYou, status: { withAction: true } })).toBe("status:primary");
    expect(forYouEntryKey({ ...forYou, status: { withAction: false } })).toBeNull();
    expect(forYouEntryKey(forYou)).toBe("hero:primary");
    expect(forYouEntryKey({ ...forYou, hasHero: false })).toBe("shelf:a:0");
    expect(forYouEntryKey({ ...forYou, hasHero: false, firstShelfKey: null })).toBeNull();
  });

  it("la clé d'une carte de rangée", () => {
    expect(rowCardKey("library:abc", 3)).toBe("library:abc:3");
  });
});
