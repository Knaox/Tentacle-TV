import { describe, expect, it } from "vitest";
import { failureMetaOf, problemFromError, rawFromError } from "./fromError";

/** Une erreur de requête, lue sans connaître sa classe, puis dite dans son contexte. */
describe("erreurs de requête", () => {
  it("lit le statut, le message et le nom, quelle que soit la classe", () => {
    class JellyfinError extends Error { constructor(public status: number) { super(`Media server API error ${status}`); this.name = "JellyfinError"; } }
    expect(rawFromError(new JellyfinError(404), "jellyfin")).toEqual({
      status: 404, message: "Media server API error 404", name: "JellyfinError", target: "jellyfin",
    });
    expect(rawFromError(new TypeError("Network request failed"), "tentacle")).toMatchObject({ status: undefined, name: "TypeError" });
    expect(rawFromError("RequestTimeout", "tentacle")).toMatchObject({ message: "RequestTimeout" });
    expect(rawFromError({ status: 0 }, "tentacle").status).toBeUndefined();
  });

  it("un geste de carte qui échoue : la cause, sans « Retour » ni adresse à corriger", () => {
    // Par le relais : une panne de transport accuse le serveur, une réponse vient de Jellyfin.
    const model = problemFromError(new TypeError("Network request failed"), { target: "relayed", context: "action", availability: { canGoBack: false } });
    expect(model).toMatchObject({ cause: "serverUnreachable", reasonKey: "errors:reasonServerUnreachable" });
    expect(problemFromError({ status: 404 }, { target: "relayed", context: "action" }).cause).toBe("itemNotFound");
    expect(problemFromError({ status: 502 }, { target: "relayed", context: "action" }).cause).toBe("jellyfinUnreachable");
    expect(problemFromError({ status: 401 }, { target: "tentacle", context: "action" }).cause).toBe("sessionExpired");
  });

  it("l'étiquette d'échec d'une mutation, ou rien", () => {
    expect(failureMetaOf({ failureTitle: "errors:toastFavoriteFailed" })).toEqual({ failureTitle: "errors:toastFavoriteFailed" });
    expect(failureMetaOf({ autre: 1 })).toBeNull();
    expect(failureMetaOf(undefined)).toBeNull();
  });
});
