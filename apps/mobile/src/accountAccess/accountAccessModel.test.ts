import { describe, expect, it } from "vitest";
import { accountAccessActions, isPlaybackRoute, loginRefusalKey } from "./accountAccessModel";

/**
 * Un compte désactivé ou hors de ses heures : la page remplace l'app, le lecteur
 * se ferme, et la connexion refusée se dit en mots — jamais « HTTP 403 ».
 */

describe("accès du compte sur le mobile", () => {
  it("les sorties de la page", () => {
    expect(accountAccessActions(false)).toEqual(["signOut", "changeServer"]);
    expect(accountAccessActions(true)[0]).toBe("switchProfile");
  });

  it("le lecteur, la bande-annonce et la lecture locale se ferment ; le reste demeure", () => {
    expect(isPlaybackRoute("/watch/abc")).toBe(true);
    expect(isPlaybackRoute("/trailer")).toBe(true);
    expect(isPlaybackRoute("/media/abc")).toBe(false);
    expect(isPlaybackRoute("/watchlist")).toBe(false);
  });

  it("une connexion refusée par le serveur se dit par sa raison", () => {
    expect(loginRefusalKey(403, { code: "account_disabled", message: "x" })).toEqual({ key: "accountAccess:refusals.account_disabled", options: { count: 1 } });
    expect(loginRefusalKey(403, { code: "account_max_sessions", message: "x", maxSessions: 2 })?.options.count).toBe(2);
    expect(loginRefusalKey(403, { code: "inconnu" })).toBeNull();
    expect(loginRefusalKey(500, { code: "account_disabled" })).toBeNull();
  });
});
