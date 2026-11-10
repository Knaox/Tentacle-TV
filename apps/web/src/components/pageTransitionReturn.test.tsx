import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { PageTransition } from "./PageTransition";
import { PageEntranceContext } from "./routeTransition/PageEntranceContext";
import { markPageEntered, resetPageEntranceMemoryForTests } from "./routeTransition/pageEntranceMemory";

const render = (id: string | undefined) =>
  renderToStaticMarkup(
    <PageEntranceContext.Provider value={id}>
      <PageTransition>
        <p>Accueil</p>
      </PageTransition>
    </PageEntranceContext.Provider>,
  );

describe("le retour sur une page déjà vue", () => {
  beforeEach(resetPageEntranceMemoryForTests);

  it("une page jamais vue part de l'opacité nulle : elle joue son entrée", () => {
    expect(render("/")).toContain("opacity:0");
  });

  it("une page déjà entrée est là d'emblée : aucune opacité de départ", () => {
    markPageEntered("/");
    expect(render("/")).not.toContain("opacity:0");
  });

  it("une autre page entre encore, et une page sans identité (test, banc) aussi", () => {
    markPageEntered("/");
    expect(render("/recommendations")).toContain("opacity:0");
    expect(render(undefined)).toContain("opacity:0");
  });
});
