import { describe, expect, it } from "vitest";
import { unknownRouteView } from "./unknownRouteView";

describe("adresse inconnue (peut-être une page d'extension)", () => {
  it("sans session : la connexion, jamais « Page introuvable »", () => {
    expect(unknownRouteView({ authed: false, pluginsLoading: false })).toBe("login");
    expect(unknownRouteView({ authed: false, pluginsLoading: true })).toBe("login");
  });

  it("en session, liste des extensions en route : attendre", () => {
    expect(unknownRouteView({ authed: true, pluginsLoading: true })).toBe("wait");
  });

  it("en session, liste connue : la page introuvable", () => {
    expect(unknownRouteView({ authed: true, pluginsLoading: false })).toBe("notFound");
  });
});
