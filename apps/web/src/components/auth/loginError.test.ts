import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "./loginError";

/**
 * L'échec de connexion se dit comme sur le mobile : identifiants, trop
 * d'essais, ou la cause du modèle commun — jamais un message technique brut.
 */
describe("loginErrorMessage", () => {
  it("les identifiants refusés et les essais trop nombreux ont leurs mots", () => {
    expect(loginErrorMessage(Object.assign(new Error("x"), { status: 401 }))).toEqual({ key: "invalidCredentials" });
    expect(loginErrorMessage(new Error("Identifiants invalides"))).toEqual({ key: "invalidCredentials" });
    expect(loginErrorMessage(Object.assign(new Error("Too Many Requests"), { status: 429 }))).toEqual({ key: "errors:loginRateLimited" });
  });

  it("une panne se dit par sa cause et son aide, sans le message brut", () => {
    expect(loginErrorMessage(new TypeError("Failed to fetch"))).toEqual({ keys: ["errors:reasonServerUnreachable", "errors:hintServerUnreachable"] });
    const relayed = loginErrorMessage(Object.assign(new Error("Media server API error 503"), { status: 503 }));
    expect("keys" in relayed && relayed.keys[0]).toBe("errors:reasonJellyfinUnreachable");
  });

  it("garde une phrase du serveur qui n'a rien de technique, sinon l'échec générique", () => {
    expect(loginErrorMessage(new Error("Compte désactivé"))).toEqual({ text: "Compte désactivé" });
    expect(loginErrorMessage(undefined)).toEqual({ key: "loginFailed" });
  });
});
