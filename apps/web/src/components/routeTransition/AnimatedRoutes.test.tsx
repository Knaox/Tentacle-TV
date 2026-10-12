import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Le lecteur n'entre jamais dans la présence des pages.
 *
 * `AnimatePresence` ne retire une page sortie que quand toutes les sorties en
 * cours ont fini : rendu sous elle, le lecteur quitté restait monté — et jouait
 * en fond — tant qu'une autre page tardait à sortir. Rendu à côté, il se démonte
 * dès qu'on le quitte.
 *
 * framer-motion et le routeur sont REMPLACÉS (chacun tire une seconde copie de
 * React sous vitest, cf. `RouteExit.test.tsx`) : `AnimatePresence` devient une
 * balise repérable, qui dit ce qui est rendu SOUS la présence ; `Routes` rend
 * la route dont le chemin commence l'adresse.
 */

const router = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  return {
    PresenceContext: React.createContext<unknown>(null),
    AnimatePresence: ({ children }: { children?: ReactNode }) =>
      React.createElement("section", { "data-presence": "" }, children),
    useIsPresent: () => true,
    useReducedMotion: () => false,
    motion: {
      div: ({ children, className }: { children?: ReactNode; className?: string }) =>
        React.createElement("div", { className }, children),
    },
  };
});

vi.mock("react-router-dom", async () => {
  const React = await import("react");
  type RouteProps = { path: string; element: ReactNode };
  return {
    Route: (_props: RouteProps) => null,
    useLocation: () => ({ pathname: router.pathname, search: "", hash: "", state: null, key: "cle" }),
    Routes: ({ location, children }: { location: { pathname: string }; children?: ReactNode }) => {
      const routes = React.Children.toArray(children) as ReactElement<RouteProps>[];
      const hit = routes.find((route) => location.pathname.startsWith(route.props.path.replace(":itemId", "")));
      return hit ? hit.props.element : null;
    },
  };
});

const { Route } = await import("react-router-dom");
const { AnimatedRoutes } = await import("./AnimatedRoutes");

function renderAt(pathname: string): string {
  router.pathname = pathname;
  return renderToStaticMarkup(
    createElement(
      AnimatedRoutes,
      null,
      createElement(Route, { path: "/watch/:itemId", element: createElement("video", { "data-player": "" }) }),
      createElement(Route, { path: "/media/:itemId", element: createElement("main", { "data-fiche": "" }) }),
    ),
  );
}

/** Le HTML rendu SOUS `AnimatePresence`. */
function insidePresence(html: string): string {
  return /<section data-presence="">([\s\S]*)<\/section>/.exec(html)?.[1] ?? "";
}

describe("AnimatedRoutes — le lecteur hors de la présence", () => {
  it("le lecteur est rendu à côté de la présence, sans enveloppe de page", () => {
    const html = renderAt("/watch/a");
    expect(html).toContain('<video data-player=""></video>');
    expect(insidePresence(html)).toBe("");
    expect(html).not.toContain("flow-root");
  });

  it("une page passe toujours par la présence et son enveloppe", () => {
    const html = renderAt("/media/a");
    const inside = insidePresence(html);
    expect(inside).toContain("data-fiche");
    expect(inside).toContain("flow-root");
    expect(html).not.toContain("data-player");
  });
});
