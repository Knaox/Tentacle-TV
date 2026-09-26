import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "./loginError";

describe("loginErrorMessage", () => {
  it("traduit les statuts connus", () => {
    expect(loginErrorMessage("HTTP 401")).toEqual({ key: "invalidCredentials" });
    expect(loginErrorMessage("503 Service Unavailable")).toEqual({ key: "common:offlineTitle" });
  });
  it("garde le message du serveur, sinon l'échec générique", () => {
    expect(loginErrorMessage("Compte désactivé")).toEqual({ text: "Compte désactivé" });
    expect(loginErrorMessage(undefined)).toEqual({ key: "loginFailed" });
  });
});
