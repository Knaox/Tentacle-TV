import { describe, expect, it, vi } from "vitest";
import { createElement, useContext, type ContextType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Une page qui sort n'attend que son enveloppe.
 *
 * Le contenu d'une page ne s'inscrit plus auprès de sa sortie : framer-motion
 * 11.18 laisse une inscription orpheline à chaque élément `layout` / `layoutId`
 * démonté (l'indicateur de l'onglet courant, à chaque changement d'onglet), et
 * la page quittée ne finissait jamais de sortir — retenant avec elle le lecteur
 * qu'on venait de quitter, qui jouait en fond.
 *
 * framer-motion est REMPLACÉ (comme dans `NextEpisodeFullscreen.test.tsx`) :
 * chargé en vrai sous vitest, il tire une seconde copie de React. Ce qui compte
 * ici n'est pas l'animation mais la présence que VOIT le contenu : le contexte
 * est un vrai contexte React. L'enveloppe elle-même n'est plus un `motion.div` :
 * elle tient sa sortie (`usePresence`) et l'efface en CSS.
 */

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const PresenceContext = React.createContext<unknown>(null);
  type Presence = { isPresent: boolean } | null;
  return {
    PresenceContext,
    // Ce que `usePresence` rend : présent, ou sortant avec de quoi dire « partie ».
    usePresence: () => {
      const presence = React.useContext(PresenceContext) as Presence;
      return presence && !presence.isPresent ? [false, () => undefined] : [true, null];
    },
    useReducedMotion: () => false,
  };
});

const { PresenceContext } = await import("framer-motion");
const { RouteExit } = await import("./RouteExit");
const { pagePresence } = await import("./pagePresence");

type Presence = ContextType<typeof PresenceContext>;

/** La présence d'une page EN TRAIN DE SORTIR, telle que `PresenceChild` la donne. */
function exitingRoute(overrides: Partial<NonNullable<Presence>> = {}) {
  const register = vi.fn(() => () => undefined);
  const onExitComplete = vi.fn();
  const value: NonNullable<Presence> = {
    id: "route", isPresent: false, register, onExitComplete, initial: false, custom: { instant: false }, ...overrides,
  };
  return { value, register, onExitComplete };
}

/** Rend `RouteExit` sous la présence donnée ; renvoie ce que son contenu en voit. */
function presenceSeenInside(outer: Presence, use?: (seen: Presence) => void): Presence | "jamais lu" {
  let seen: Presence | "jamais lu" = "jamais lu";
  function Probe() {
    const presence = useContext(PresenceContext);
    seen = presence;
    use?.(presence);
    return null;
  }
  renderToStaticMarkup(
    createElement(PresenceContext.Provider, { value: outer }, createElement(RouteExit, null, createElement(Probe))),
  );
  return seen;
}

describe("RouteExit — la présence vue du contenu de la page", () => {
  it("le contenu ne s'inscrit jamais auprès de la sortie de la page", () => {
    const route = exitingRoute();
    // Ce que fait `usePresence` (donc tout élément `layout` / `layoutId`) au
    // montage : s'inscrire — puis, démonté, ne jamais se désinscrire.
    const seen = presenceSeenInside(route.value, (presence) => { presence?.register("indicateur-d-onglet"); });
    expect(route.register).not.toHaveBeenCalled();
    expect(seen).not.toBeNull();
    expect(seen).not.toBe("jamais lu");
    const inside = seen as NonNullable<Presence>;
    expect(inside.register).not.toBe(route.register);
    expect(inside.onExitComplete).toBeUndefined();
  });

  it("le contenu se voit présent, même pendant la sortie de la page", () => {
    const seen = presenceSeenInside(exitingRoute().value) as NonNullable<Presence>;
    expect(seen.isPresent).toBe(true);
  });

  it("reprend `initial` : le premier rendu de l'application reste sans entrée animée", () => {
    const seen = presenceSeenInside(exitingRoute({ isPresent: true, initial: false }).value) as NonNullable<Presence>;
    expect(seen.initial).toBe(false);
  });

  it("hors de toute présence (rendu sans AnimatePresence), le contenu n'en voit aucune", () => {
    expect(presenceSeenInside(null)).toBeNull();
  });
});

describe("RouteExit — la page qui en remplace une autre", () => {
  /** Rend une page PRÉSENTE sous un niveau de transition ; renvoie son HTML et ce que son contenu voit. */
  async function renderPresent(replaces: boolean) {
    const { TransitionLevelContext, createTransitionLevel } = await import("./transitionLevel");
    const level = createTransitionLevel();
    let seen: Presence | "jamais lu" = "jamais lu";
    function Probe() {
      seen = useContext(PresenceContext);
      return createElement("p", null, "page");
    }
    const html = renderToStaticMarkup(
      createElement(TransitionLevelContext.Provider, { value: level },
        createElement(PresenceContext.Provider, { value: exitingRoute({ isPresent: true, initial: undefined }).value },
          createElement(RouteExit, { replaces, children: createElement(Probe) }))),
    );
    return { html, seen: seen as unknown as NonNullable<Presence> };
  }

  it("se prépare cachée, et son contenu ne joue pas ses entrées", async () => {
    const { html, seen } = await renderPresent(true);
    expect(html).toContain("visibility:hidden");
    expect(html).toContain('data-page-held="true"');
    expect(seen.initial).toBe(false);
  });

  it("la première page d'un niveau ne remplace rien : visible d'emblée, entrées laissées à leur contexte", async () => {
    const { html, seen } = await renderPresent(false);
    expect(html).not.toContain("visibility:hidden");
    expect(html).not.toContain("data-page-held");
    expect(seen.initial).toBeUndefined();
  });

  it("sans présence au-dessus (le client LG démonte sans attendre), aucune tenue : jamais un écran vide", async () => {
    const { TransitionLevelContext, createTransitionLevel } = await import("./transitionLevel");
    const html = renderToStaticMarkup(
      createElement(TransitionLevelContext.Provider, { value: createTransitionLevel() },
        createElement(RouteExit, { replaces: true, children: createElement("p", null, "page") })),
    );
    expect(html).not.toContain("visibility:hidden");
  });

  it("hors de tout niveau (test, banc), aucune tenue", () => {
    const html = renderToStaticMarkup(createElement(RouteExit, { replaces: true, children: createElement("p", null, "page") }));
    expect(html).not.toContain("visibility:hidden");
  });
});

describe("RouteExit — la plaque de la page quittée", () => {
  const PLATE = "position:fixed;inset:0;z-index:-1;background-color:var(--surface-0)";
  const leaving = (props: Record<string, unknown> = {}) => renderToStaticMarkup(
    createElement(PresenceContext.Provider, { value: exitingRoute().value },
      createElement(RouteExit, { ...props, children: createElement("p", null, "page") })),
  );

  it("une page qui sort couvre l'écran de l'encre de la page ; en place, elle n'a pas de plaque", () => {
    expect(leaving()).toContain(PLATE);
    const present = renderToStaticMarkup(
      createElement(PresenceContext.Provider, { value: exitingRoute({ isPresent: true }).value },
        createElement(RouteExit, { children: createElement("p", null, "page") })),
    );
    expect(present).not.toContain(PLATE);
  });

  it("sous le verre aussi : sans plaque, la page d'arrivée se lisait à travers celle qu'on quitte", () => {
    const root = { getAttribute: (name: string) => (name === "data-liquid-glass" ? "native" : null) };
    vi.stubGlobal("document", { documentElement: root });
    try {
      expect(leaving()).toContain(PLATE);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("reprend sur la plaque le fond que la page n'a pas dans son enveloppe (le fond ambiant de la coquille)", () => {
    const html = leaving({ backdrop: createElement("i", { className: "lg-ambient" }) });
    expect(html).toContain(`style="${PLATE}"><i class="lg-ambient"></i></div>`);
  });
});

describe("pagePresence", () => {
  it("une page toujours présente, au registre muet", () => {
    const presence = pagePresence("route", undefined);
    expect(presence.isPresent).toBe(true);
    expect(presence.onExitComplete).toBeUndefined();
    const unregister = presence.register("x");
    expect(typeof unregister).toBe("function");
    expect(() => unregister()).not.toThrow();
  });
});
