import { describe, expect, it } from "vitest";
import { toUserData } from "./userAccess";

describe("toUserData", () => {
  it("garde Ma liste (le « j'aime » de Jellyfin) pour que la carte d'un film trouvé montre son signet", () => {
    expect(toUserData({ Likes: true, Played: false }).Likes).toBe(true);
  });

  it("n'écrit rien quand le titre n'est pas dans Ma liste", () => {
    const data = toUserData({ Likes: false, IsFavorite: true });
    expect("Likes" in data).toBe(false);
    expect(data.IsFavorite).toBe(true);
  });
});
