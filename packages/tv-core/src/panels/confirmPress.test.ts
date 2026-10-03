import { describe, expect, it } from "vitest";
import { confirmBlur, confirmPress } from "./confirmPress";

type Action = "logout" | "changeServer";

describe("la confirmation à double appui", () => {
  it("le premier OK arme, sans exécuter", () => {
    expect(confirmPress<Action>(null, "logout")).toEqual({ armed: "logout", run: false });
  });

  it("le second OK, sur le même bouton, exécute et désarme", () => {
    expect(confirmPress<Action>("logout", "logout")).toEqual({ armed: null, run: true });
  });

  it("OK sur un autre bouton arme celui-là, sans rien exécuter", () => {
    expect(confirmPress<Action>("logout", "changeServer")).toEqual({ armed: "changeServer", run: false });
  });

  it("quitter le bouton armé désarme ; quitter un autre bouton ne change rien", () => {
    expect(confirmBlur<Action>("logout", "logout")).toBeNull();
    expect(confirmBlur<Action>("logout", "changeServer")).toBe("logout");
    expect(confirmBlur<Action>(null, "logout")).toBeNull();
  });
});
