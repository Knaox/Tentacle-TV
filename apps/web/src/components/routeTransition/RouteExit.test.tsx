import { describe, expect, it, vi } from "vitest";
import { createElement, useContext, type ContextType, type ReactNode } from "react";
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
 * est un vrai contexte React, `motion.div` une balise nue.
 */

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const PresenceContext = React.createContext<unknown>(null);
  type Presence = { isPresent: boolean } | null;
  return {
    PresenceContext,
    useIsPresent: () => (React.useContext(PresenceContext) as Presence)?.isPresent ?? true,
    useReducedMotion: () => false,
    motion: {
      div: ({ children, className }: { children?: ReactNode; className?: string }) =>
        React.createElement("div", { className }, children),
    },
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
