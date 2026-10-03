import { describe, expect, it } from "vitest";
import { loginKeyboardSubmits, loginSubmitPress } from "./loginForm";

describe("« Se connecter »", () => {
  it("ouvre le premier champ vide, sinon envoie", () => {
    expect(loginSubmitPress({ username: "", password: "" })).toBe("openUsername");
    expect(loginSubmitPress({ username: "   ", password: "x" })).toBe("openUsername");
    expect(loginSubmitPress({ username: "banc", password: "" })).toBe("openPassword");
    expect(loginSubmitPress({ username: "banc", password: "x" })).toBe("submit");
  });
});

describe("valider un clavier", () => {
  it("n'envoie que le formulaire complet", () => {
    expect(loginKeyboardSubmits({ username: "banc", password: "x" })).toBe(true);
    expect(loginKeyboardSubmits({ username: "banc", password: "" })).toBe(false);
    expect(loginKeyboardSubmits({ username: " ", password: "x" })).toBe(false);
  });

  it("un mot de passe fait d'espaces compte : seul l'identifiant est rogné", () => {
    expect(loginKeyboardSubmits({ username: "banc", password: "  " })).toBe(true);
  });
});
