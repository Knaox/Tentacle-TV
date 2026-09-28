import { describe, expect, it } from "vitest";
import { collapseDetailChain, DETAIL_ROUTE } from "./detailChain";

const tabs = { key: "tabs", name: "(tabs)" };
const detail = (key: string) => ({ key, name: DETAIL_ROUTE });

describe("collapseDetailChain", () => {
  it("replie la fiche posée sur une fiche", () => {
    expect(collapseDetailChain([tabs, detail("a"), detail("b")], "b")).toEqual([tabs, detail("b")]);
  });

  it("rattrape plusieurs fiches restées dessous", () => {
    expect(collapseDetailChain([tabs, detail("a"), detail("b"), detail("c")], "c")).toEqual([tabs, detail("c")]);
  });

  it("garde l'écran d'origine entre deux chaînes", () => {
    const library = { key: "lib", name: "library/[libraryId]" };
    expect(collapseDetailChain([tabs, detail("a"), library, detail("b")], "b")).toBeNull();
  });

  it("ne touche pas à ce qui est empilé au-dessus", () => {
    const watch = { key: "w", name: "watch/[itemId]" };
    expect(collapseDetailChain([tabs, detail("a"), detail("b"), watch], "b")).toEqual([tabs, detail("b"), watch]);
  });

  it("rien à replier : première fiche, autre écran, clé inconnue", () => {
    expect(collapseDetailChain([tabs, detail("a")], "a")).toBeNull();
    expect(collapseDetailChain([detail("a")], "a")).toBeNull();
    expect(collapseDetailChain([tabs, detail("a"), { key: "s", name: "search" }], "s")).toBeNull();
    expect(collapseDetailChain([tabs, detail("a")], "zzz")).toBeNull();
  });
});
