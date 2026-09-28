import { describe, expect, it } from "vitest";
import { loginPathKeepingRedirect, safeRedirect } from "./authRedirect";

describe("safeRedirect", () => {
  it("garde un chemin interne", () => {
    expect(safeRedirect("/share/abc")).toBe("/share/abc");
  });
  it("refuse une adresse externe ou sans chemin", () => {
    expect(safeRedirect("https://evil.example")).toBeNull();
    expect(safeRedirect("//evil.example")).toBeNull();
    expect(safeRedirect(null)).toBeNull();
  });
});

describe("loginPathKeepingRedirect", () => {
  it("transmet le retour d'un partage", () => {
    expect(loginPathKeepingRedirect(new URLSearchParams("invite=K&redirect=%2Fshare%2Fabc")))
      .toBe("/login?redirect=%2Fshare%2Fabc");
  });
  it("rend /login sans retour valable", () => {
    expect(loginPathKeepingRedirect(new URLSearchParams("redirect=//x"))).toBe("/login");
    expect(loginPathKeepingRedirect(new URLSearchParams())).toBe("/login");
  });
});
