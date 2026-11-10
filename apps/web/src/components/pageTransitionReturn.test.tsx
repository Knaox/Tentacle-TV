import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// framer-motion embarque son propre React sous vitest : on ne garde que ce que la page lui
// demande — l'état de DÉPART, écrit dans un attribut pour le lire.
vi.mock("framer-motion", () => ({
  useReducedMotion: () => false,
  motion: {
    div: ({ initial, children }: { initial: false | { opacity: number }; children?: ReactNode }) => (
      <div data-initial={initial === false ? "none" : `opacity:${initial.opacity}`}>{children}</div>
    ),
  },
}));

import { PageTransition } from "./PageTransition";
import { PageEntranceContext } from "./routeTransition/PageEntranceContext";
import { markPageEntered, resetPageEntranceMemoryForTests } from "./routeTransition/pageEntranceMemory";

const render = (id: string | undefined, skip = false) =>
  renderToStaticMarkup(
    <PageEntranceContext.Provider value={id}>
      <PageTransition skip={skip}>
        <p>Accueil</p>
      </PageTransition>
    </PageEntranceContext.Provider>,
  );

describe("le retour sur une page déjà vue", () => {
  beforeEach(resetPageEntranceMemoryForTests);

  it("une page jamais vue part de l'opacité nulle : elle joue son entrée", () => {
    expect(render("/")).toContain('data-initial="opacity:0"');
  });

  it("une page déjà entrée est là d'emblée : aucun état de départ", () => {
    markPageEntered("/");
    expect(render("/")).toContain('data-initial="none"');
  });

  it("une autre page entre encore, et une page sans identité (test, banc) aussi", () => {
    markPageEntered("/");
    expect(render("/recommendations")).toContain('data-initial="opacity:0"');
    expect(render(undefined)).toContain('data-initial="opacity:0"');
  });

  it("`skip` (la fiche ouverte par son calque) garde le dessus : jamais d'entrée", () => {
    expect(render("/media/x", true)).toContain('data-initial="none"');
  });
});
