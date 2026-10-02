import { describe, expect, it } from "vitest";
import type { Box } from "./geometry";
import { facingItems, isBeyond, pickSectionNeighbor, type SectionGeometry } from "./sections";

/**
 * La règle des sections sur des cotes d'Apple TV (1920 × 1080, colonne de
 * contenu à 136) : les cas que l'utilisateur a vus sur l'appareil, puis ceux
 * qui en découlent.
 */

function box(left: number, top: number, width: number, height: number): Box {
  return { left, top, right: left + width, bottom: top + height };
}

/** Une rangée de `count` cartes de `width`, espacées de `gap`, depuis `left`. */
function row(name: string, top: number, count: number, { left = 136, width = 260, gap = 24, height = 420, header = 0 } = {}): SectionGeometry<string> {
  const items = Array.from({ length: count }, (_, i) => ({ element: `${name}:${i}`, box: box(left + i * (width + gap), top + header, width, height) }));
  return { box: box(0, top, 1920, header + height), items };
}

const itemOf = (section: SectionGeometry<string>, element: string) => section.items.find((item) => item.element === element)!.box;
const from = (section: SectionGeometry<string>, element: string) => ({
  section: section.box,
  item: itemOf(section, element),
  siblings: section.items.filter((item) => item.element !== element),
});

describe("HAUT / BAS vers la section voisine", () => {
  it("au bout d'un carrousel, BAS atteint la rangée plus courte du dessous — sa dernière carte", () => {
    const long = row("long", 100, 6);
    const short = row("short", 600, 2);
    expect(pickSectionNeighbor(from(long, "long:5"), [long, short], "bas")).toBe("short:1");
  });

  it("HAUT est le miroir : depuis le bout d'une rangée courte, la carte la plus proche au-dessus", () => {
    const long = row("long", 100, 6);
    const short = row("short", 600, 2);
    expect(pickSectionNeighbor(from(short, "short:1"), [long, short], "haut")).toBe("long:1");
  });

  it("ne saute jamais la rangée voisine pour une rangée plus loin, alignée", () => {
    const top = row("a", 100, 6);
    const short = row("b", 600, 1);
    const below = row("c", 1100, 6);
    expect(pickSectionNeighbor(from(top, "a:5"), [top, short, below], "bas")).toBe("b:0");
  });

  it("un réglage un peu trop à gauche est atteint quand même", () => {
    const toggle: SectionGeometry<string> = { box: box(700, 200, 1100, 90), items: [{ element: "toggle", box: box(1400, 210, 360, 70) }] };
    const pills: SectionGeometry<string> = {
      box: box(700, 310, 1100, 90),
      items: [
        { element: "server", box: box(720, 320, 300, 70) },
        { element: "unpair", box: box(1040, 320, 320, 70) },
      ],
    };
    expect(pickSectionNeighbor({ section: toggle.box, item: itemOf(toggle, "toggle") }, [toggle, pills], "bas")).toBe("unpair");
  });

  it("le centre décide, pas le premier chevauchement", () => {
    const wide: SectionGeometry<string> = { box: box(0, 100, 1920, 80), items: [{ element: "wide", box: box(136, 100, 800, 80) }] };
    const cards = row("card", 260, 6, { width: 280 });
    // Centre 536 : la carte 1 (centre 580) l'emporte sur la carte 0 (centre 276), qui chevauche aussi.
    expect(pickSectionNeighbor({ section: wide.box, item: itemOf(wide, "wide") }, [wide, cards], "bas")).toBe("card:1");
  });

  it("à égalité de centre, le plus à gauche", () => {
    const source: SectionGeometry<string> = { box: box(0, 0, 1920, 100), items: [{ element: "x", box: box(400, 0, 200, 100) }] };
    const below: SectionGeometry<string> = {
      box: box(0, 200, 1920, 100),
      items: [
        { element: "right", box: box(550, 200, 100, 100) },
        { element: "left", box: box(350, 200, 100, 100) },
      ],
    };
    expect(pickSectionNeighbor({ section: source.box, item: itemOf(source, "x") }, [source, below], "bas")).toBe("left");
  });

  it("une section sans élément focalisable est sautée", () => {
    const top = row("a", 100, 6);
    const empty: SectionGeometry<string> = { box: box(0, 600, 1920, 300), items: [] };
    const below = row("c", 1000, 6);
    expect(pickSectionNeighbor(from(top, "a:2"), [top, empty, below], "bas")).toBe("c:2");
  });

  it("rien au-delà : la règle ne décide rien", () => {
    const only = row("a", 100, 6);
    expect(pickSectionNeighbor(from(only, "a:2"), [only], "bas")).toBeNull();
    expect(pickSectionNeighbor(from(only, "a:2"), [only], "haut")).toBeNull();
  });
});

describe("rangées de formats différents (vignettes 16:9, affiches 2:3)", () => {
  // L'accueil d'Apple TV : « Reprendre » et « Prochains épisodes » en
  // vignettes de 380 (légende comprise, 286 de haut), puis des affiches de 240
  // (432) ; 36 d'écart, colonne de contenu à 176, titre de rangée de 58. Les
  // cartes de deux formats ne sont jamais alignées : le centre décide.
  const landscape = (name: string, top: number, count = 5) => row(name, top, count, { left: 176, width: 380, gap: 36, height: 286, header: 58 });
  const posters = (name: string, top: number, count = 7) => row(name, top, count, { left: 176, width: 240, gap: 36, height: 432, header: 58 });
  const resume = landscape("resume", 100);
  const nextUp = landscape("nextUp", 484);
  const forYou = posters("forYou", 868);
  const page = [resume, nextUp, forYou];

  it("d'une rangée de vignettes à l'autre, la vignette à l'aplomb", () => {
    expect(pickSectionNeighbor(from(resume, "resume:2"), page, "bas")).toBe("nextUp:2");
    expect(pickSectionNeighbor(from(nextUp, "nextUp:3"), page, "haut")).toBe("resume:3");
  });

  it("BAS depuis une vignette : l'affiche dont le centre est le plus proche", () => {
    // Centre 782 : l'affiche 2 (848) l'emporte sur l'affiche 1 (572).
    expect(pickSectionNeighbor(from(nextUp, "nextUp:1"), page, "bas")).toBe("forYou:2");
  });

  it("HAUT depuis une affiche : la vignette la plus proche, même décalée", () => {
    // Centre 1400 : la vignette 2 (1198) l'emporte de peu sur la vignette 3 (1614).
    expect(pickSectionNeighbor(from(forYou, "forYou:4"), page, "haut")).toBe("nextUp:2");
  });

  it("HAUT depuis le bout des affiches : la dernière vignette d'une rangée plus courte", () => {
    const short = landscape("nextUp", 484, 3);
    expect(pickSectionNeighbor(from(forYou, "forYou:6"), [resume, short, forYou], "haut")).toBe("nextUp:2");
  });

  it("des affiches au-dessus des vignettes (une mise en page du compte) : BAS au plus proche", () => {
    const above = posters("watchlist", 100);
    const below = landscape("nextUp", 590);
    // Centre 1124 : la vignette 2 (1198).
    expect(pickSectionNeighbor(from(above, "watchlist:3"), [above, below], "bas")).toBe("nextUp:2");
  });

  it("des vignettes entre deux rangées d'affiches (« Déjà vu ») : jamais sautées, le centre décide de chaque pas", () => {
    const above = posters("forYou", 100);
    const watched = landscape("watched", 630);
    const below = posters("watchlist", 1014);
    const stack = [above, watched, below];
    // 1400 → 1198 (plutôt que 1614), puis 1198 → 1124 ; et en remontant, 1124 → 1198 → 1124.
    expect(pickSectionNeighbor(from(above, "forYou:4"), stack, "bas")).toBe("watched:2");
    expect(pickSectionNeighbor(from(watched, "watched:2"), stack, "bas")).toBe("watchlist:3");
    expect(pickSectionNeighbor(from(below, "watchlist:3"), stack, "haut")).toBe("watched:2");
    expect(pickSectionNeighbor(from(watched, "watched:2"), stack, "haut")).toBe("forYou:3");
  });
});

describe("grilles", () => {
  const lines = [row("l0", 100, 6, { width: 240, height: 360 }), row("l1", 520, 6, { width: 240, height: 360 }), row("l2", 940, 2, { width: 240, height: 360 })];

  it("dernière ligne incomplète : BAS depuis la colonne orpheline atterrit sur sa dernière affiche", () => {
    expect(pickSectionNeighbor(from(lines[1], "l1:5"), lines, "bas")).toBe("l2:1");
  });

  it("une grille d'une seule section : la face du dessous garde les colonnes orphelines", () => {
    const grid: SectionGeometry<string> = { box: box(0, 100, 1920, 1200), items: lines.flatMap((line) => line.items) };
    const facing = facingItems(grid, "haut").map((item) => item.element);
    expect(facing).toEqual(["l1:2", "l1:3", "l1:4", "l1:5", "l2:0", "l2:1"]);
    expect(facingItems(grid, "bas").map((item) => item.element)).toEqual(lines[0].items.map((item) => item.element));
  });
});

describe("accessoire d'en-tête (la pastille du filtre)", () => {
  // La rangée filtrée : son titre et la pastille (à droite du titre), puis ses cartes dessous.
  const previous = row("prev", 100, 6);
  const filtered: SectionGeometry<string> = {
    box: box(0, 600, 1920, 500),
    items: [{ element: "filter:remove", box: box(640, 600, 240, 52) }, ...row("reco", 600, 6, { header: 80 }).items],
  };

  it("depuis l'extrémité droite de la rangée d'au-dessus, BAS va aux cartes — la pastille n'est pas une étape obligée", () => {
    expect(pickSectionNeighbor(from(previous, "prev:5"), [previous, filtered], "bas")).toBe("reco:5");
  });

  it("depuis l'aplomb de la pastille, BAS va sur elle", () => {
    expect(pickSectionNeighbor(from(previous, "prev:2"), [previous, filtered], "bas")).toBe("filter:remove");
  });

  it("HAUT depuis la carte sous la pastille : la pastille, à l'aplomb, dans la section", () => {
    expect(pickSectionNeighbor(from(filtered, "reco:2"), [previous, filtered], "haut")).toBe("filter:remove");
  });

  it("HAUT depuis le bout de la rangée filtrée : la rangée d'au-dessus — la pastille n'est pas dans l'axe", () => {
    expect(pickSectionNeighbor(from(filtered, "reco:5"), [previous, filtered], "haut")).toBe("prev:5");
  });

  it("BAS depuis la pastille : la carte qui est dessous, dans sa rangée", () => {
    expect(pickSectionNeighbor(from(filtered, "filter:remove"), [previous, filtered], "bas")).toBe("reco:2");
  });

  it("en remontant vers la rangée filtrée, ce sont ses cartes qui font face", () => {
    const next = row("next", 1200, 6);
    expect(pickSectionNeighbor(from(next, "next:2"), [previous, filtered, next], "haut")).toBe("reco:2");
  });
});

describe("pastilles qui passent à la ligne, dans une section", () => {
  // Deux lignes de genres : six pastilles, puis deux.
  const chips = (top: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({ element: `genre:${top}:${i}`, box: box(136 + i * 250, top, 230, 64) }));
  const genres: SectionGeometry<string> = { box: box(0, 300, 1920, 160), items: [...chips(300, 6), ...chips(380, 2)] };

  it("BAS depuis le bout de la première ligne : la seconde, plus courte — sa dernière pastille", () => {
    expect(pickSectionNeighbor(from(genres, "genre:300:5"), [genres], "bas")).toBe("genre:380:1");
  });

  it("HAUT depuis la seconde ligne : à l'aplomb, dans la première", () => {
    expect(pickSectionNeighbor(from(genres, "genre:380:1"), [genres], "haut")).toBe("genre:300:1");
  });
});

describe("une liste de lignes (un panneau de réglages)", () => {
  // Un interrupteur à droite, puis deux pilules côte à côte, plus à gauche et
  // de hauteurs différentes ; puis une pastille seule, à gauche.
  const panel: SectionGeometry<string> = {
    box: box(700, 100, 1100, 500),
    items: [
      { element: "toggle", box: box(1400, 110, 360, 70) },
      { element: "server", box: box(720, 230, 300, 70) },
      { element: "unpair", box: box(1040, 239, 320, 52) },
      { element: "lang", box: box(720, 360, 120, 52) },
    ],
  };
  const inList = (element: string) => ({ ...from(panel, element), list: true });

  it("HAUT depuis le réglage un peu trop à gauche atteint celui du dessus", () => {
    expect(pickSectionNeighbor(inList("unpair"), [panel], "haut")).toBe("toggle");
    // Sans liste, l'aplomb seul : rien au-dessus, la règle ne décide rien.
    expect(pickSectionNeighbor(from(panel, "unpair"), [panel], "haut")).toBeNull();
  });

  it("des contrôles de hauteurs différentes, centrés, sont la même ligne", () => {
    expect(pickSectionNeighbor(inList("toggle"), [panel], "bas")).toBe("unpair");
    expect(pickSectionNeighbor(inList("lang"), [panel], "haut")).toBe("server");
  });
});

describe("colonnes et entrées", () => {
  it("une section d'une autre colonne n'est jamais visée", () => {
    const results: SectionGeometry<string> = { box: box(800, 100, 1000, 300), items: [{ element: "result", box: box(820, 120, 300, 260) }] };
    const keyboard: SectionGeometry<string> = { box: box(100, 500, 600, 400), items: [{ element: "key", box: box(120, 520, 80, 80) }] };
    expect(pickSectionNeighbor({ section: results.box, item: itemOf(results, "result") }, [results, keyboard], "bas")).toBeNull();
  });

  it("deux sections côte à côte, à la même hauteur : la plus proche des deux", () => {
    const top: SectionGeometry<string> = { box: box(0, 0, 1920, 100), items: [{ element: "x", box: box(1300, 0, 200, 100) }] };
    const left: SectionGeometry<string> = { box: box(0, 200, 900, 100), items: [{ element: "left", box: box(100, 200, 200, 100) }] };
    const right: SectionGeometry<string> = { box: box(960, 204, 900, 100), items: [{ element: "right", box: box(1000, 204, 200, 100) }] };
    expect(pickSectionNeighbor({ section: top.box, item: itemOf(top, "x") }, [top, left, right], "bas")).toBe("right");
  });

  it("l'entrée déclarée l'emporte : l'onglet de la saison affichée", () => {
    const header = row("action", 100, 4, { width: 200, height: 70 });
    const tabs: SectionGeometry<string> = { ...row("season", 300, 8, { width: 150, height: 50 }), entry: "season:6" };
    expect(pickSectionNeighbor(from(header, "action:0"), [header, tabs], "bas")).toBe("season:6");
  });

  it("une entrée qui n'est pas (ou plus) parmi les éléments est ignorée", () => {
    const header = row("action", 100, 4, { width: 200, height: 70 });
    const tabs: SectionGeometry<string> = { ...row("season", 300, 3, { width: 150, height: 50 }), entry: "season:9" };
    expect(pickSectionNeighbor(from(header, "action:0"), [header, tabs], "bas")).toBe("season:0");
  });

  it("une affiche qui déborde de quelques points sur sa voisine reste « au-delà » ; une section à la même hauteur, non", () => {
    expect(isBeyond(box(0, 0, 1920, 500), box(0, 488, 1920, 500), "bas")).toBe(true);
    expect(isBeyond(box(0, 0, 900, 500), box(960, 100, 900, 500), "bas")).toBe(false);
  });
});
