import { describe, expect, it } from "vitest";
import { launchRedirectOf, launchRedirectPending, settleLaunchRedirect, takeLaunchRedirect } from "./launchRedirect";

describe("redirection du lancement en Octave — jamais de boucle", () => {
  it("relancée en Octave : la coquille de Tentacle attend, la redirection part UNE fois", () => {
    let r = launchRedirectOf(true, "/octave/album/a1");
    expect(launchRedirectPending(r)).toBe(true);
    const first = takeLaunchRedirect(r, true);
    expect(first.go).toBe("/octave/album/a1");
    r = first.next;
    // Tout rendu, tout retour sur l'entrée ensuite : plus rien ne repart.
    for (let i = 0; i < 50; i++) expect(takeLaunchRedirect(r, true).go).toBeNull();
  });

  it("la porte d'Octave rend la main à Tentacle : tranchée, plus jamais renvoyée dans Octave", () => {
    let r = takeLaunchRedirect(launchRedirectOf(true, "/octave"), true).next;
    r = settleLaunchRedirect(r);
    expect(launchRedirectPending(r)).toBe(false);
    expect(takeLaunchRedirect(r, true).go).toBeNull();
  });

  it("Octave atteint : la coquille de Tentacle se peindra normalement plus tard", () => {
    const r = settleLaunchRedirect(takeLaunchRedirect(launchRedirectOf(true, "/octave/search?q=x"), true).next);
    expect(launchRedirectPending(r)).toBe(false);
  });

  it("ouverte sur un lien profond : la page demandée reste, sans redirection", () => {
    const { next, go } = takeLaunchRedirect(launchRedirectOf(true, "/octave"), false);
    expect(go).toBeNull();
    expect(launchRedirectPending(next)).toBe(false);
  });

  it("quittée en Tentacle : rien n'attend, rien ne part", () => {
    const r = launchRedirectOf(false, null);
    expect(launchRedirectPending(r)).toBe(false);
    expect(takeLaunchRedirect(r, true).go).toBeNull();
  });
});
