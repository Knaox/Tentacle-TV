import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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

const render = (underRoute: boolean, skip = false) =>
  renderToStaticMarkup(
    <PageEntranceContext.Provider value={underRoute}>
      <PageTransition skip={skip} className="page">
        <p>Accueil</p>
      </PageTransition>
    </PageEntranceContext.Provider>,
  );

describe("l'entrée d'une page", () => {
  it("sous une route, la page ne joue aucune entrée : celle de la route suffit", () => {
    // La page quittée s'efface par-dessus elle (`RouteExit`) ; un second fondu, croisé avec le
    // premier, faisait passer l'écran par le fond de page.
    const html = render(true);
    expect(html).toBe('<div class="page"><p>Accueil</p></div>');
  });

  it("au retour d'une fiche non plus : la page est là d'emblée, quelle qu'elle soit", () => {
    expect(render(true, true)).not.toContain("data-initial");
  });

  it("hors d'une route (vue d'Octave, banc), la page entre en fondu", () => {
    expect(render(false)).toContain('data-initial="opacity:0"');
  });

  it("`skip` garde le dessus hors d'une route : jamais d'entrée", () => {
    expect(render(false, true)).toContain('data-initial="none"');
  });
});
