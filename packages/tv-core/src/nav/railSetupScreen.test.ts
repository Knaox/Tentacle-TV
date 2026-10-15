import { describe, expect, it } from "vitest";

import { arrangeOnFocus, rowsSelectWhileArranging, startArrange } from "./arrange";
import {
  RAIL_SETUP_CONTINUE_KEY,
  RAIL_SETUP_SKIP_KEY,
  RAIL_SETUP_WAIT_MAX_MS,
  railSetupArrangeReading,
  railSetupArrival,
  railSetupBackAction,
  railSetupEntryKey,
  railSetupFullOrder,
  railSetupHidden,
  railSetupLibraryKeys,
  railSetupLockedKeys,
  railSetupMoveKey,
  railSetupRowKey,
  routeAfterSession,
} from "./railSetupScreen";
import {
  RAIL_SETUP_APPLY_DECLINE_KEY,
  railSetupAfterContinue,
  railSetupApplyDue,
  railSetupApplyEnabled,
  railSetupApplyEntryKey,
  railSetupApplyTileKey,
  toggleRailSetupTarget,
} from "./railSetupApply";

const FULL = ["Recommendations", "Library_a", "Watchlist", "Library_b", "Favorites", "Library_c"];

describe("railSetupLibraryKeys — la liste ne montre que les bibliothèques", () => {
  it("dans l'ordre de la barre, sans Pour vous, Ma liste ni Favoris", () => {
    expect(railSetupLibraryKeys(FULL)).toEqual(["Library_a", "Library_b", "Library_c"]);
  });
});

describe("railSetupArrangeReading — le déplacement suit la colonne des pastilles", () => {
  const libs = ["Library_a", "Library_b", "Library_c"];

  it("la pastille d'une case porte la bibliothèque de cette case dans l'ordre EN COURS", () => {
    expect(railSetupArrangeReading(railSetupMoveKey(2), libs)).toEqual({ kind: "entry", key: "Library_c" });
  });

  it("une ligne (verrouillée) ou une case vide : rien ne bouge", () => {
    expect(railSetupArrangeReading(railSetupRowKey(1), libs)).toEqual({ kind: "inside" });
    expect(railSetupArrangeReading(railSetupMoveKey(9), libs)).toEqual({ kind: "inside" });
  });

  it("hors de la liste (le pied) : l'entrée est posée", () => {
    expect(railSetupArrangeReading(RAIL_SETUP_CONTINUE_KEY, libs)).toEqual({ kind: "outside" });
  });

  it("la machine commune déplace, et OK sur la pastille soulevée pose", () => {
    const move = startArrange("Library_a", libs, 0);
    const outcome = arrangeOnFocus(move, railSetupArrangeReading(railSetupMoveKey(1), libs));
    expect(outcome).toEqual({ kind: "reorder", move: { key: "Library_a", order: ["Library_b", "Library_a", "Library_c"], from: 0 } });
    expect(rowsSelectWhileArranging(move, "Library_a")).toBe("drop");
  });
});

describe("railSetupLockedKeys — pendant un déplacement", () => {
  it("les lignes et les deux actions du pied, jamais les pastilles", () => {
    expect(railSetupLockedKeys(2)).toEqual([railSetupRowKey(0), railSetupRowKey(1), RAIL_SETUP_CONTINUE_KEY, RAIL_SETUP_SKIP_KEY]);
  });
});

describe("railSetupFullOrder — l'ordre complet à enregistrer", () => {
  it("les bibliothèques prennent les cases des bibliothèques ; Pour vous, Ma liste, Favoris restent", () => {
    expect(railSetupFullOrder(FULL, ["Library_c", "Library_a", "Library_b"])).toEqual([
      "Recommendations", "Library_c", "Watchlist", "Library_a", "Favorites", "Library_b",
    ]);
  });

  it("une bibliothèque inconnue de l'ordre complet se range à la suite ; un doublon ne compte qu'une fois", () => {
    expect(railSetupFullOrder(["Recommendations", "Library_a"], ["Library_new", "Library_a", "Library_a"])).toEqual([
      "Recommendations", "Library_new", "Library_a",
    ]);
  });

  it("une bibliothèque que la page ne montre pas garde sa case", () => {
    expect(railSetupFullOrder(FULL, ["Library_c", "Library_b"])).toEqual([
      "Recommendations", "Library_a", "Watchlist", "Library_c", "Favorites", "Library_b",
    ]);
  });
});

describe("railSetupHidden — les masquées à enregistrer", () => {
  it("garde l'état des entrées fixes, remplace celui des bibliothèques", () => {
    const pinned = new Set(["Library_b"]);
    expect(railSetupHidden(["Favorites", "Library_b"], ["Library_a", "Library_b"], (key) => pinned.has(key))).toEqual([
      "Favorites", "Library_a",
    ]);
  });
});

describe("railSetupEntryKey — le focus d'entrée", () => {
  it("la première bibliothèque, jamais « Passer »", () => {
    expect(railSetupEntryKey(3)).toBe(railSetupRowKey(0));
    expect(railSetupEntryKey(0)).toBe(RAIL_SETUP_CONTINUE_KEY);
  });
});

describe("railSetupBackAction — Retour", () => {
  it("annule d'abord un déplacement, puis passe (liste) ou décline (étape du propriétaire)", () => {
    expect(railSetupBackAction("libraries", true)).toBe("cancelMove");
    expect(railSetupBackAction("libraries", false)).toBe("skip");
    expect(railSetupBackAction("apply", false)).toBe("decline");
  });
});

describe("routeAfterSession et railSetupArrival — la page passe avant l'accueil", () => {
  it("la page si elle est due, sinon l'accueil", () => {
    expect(routeAfterSession(true)).toBe("RailSetup");
    expect(routeAfterSession(false)).toBe("Home");
  });

  it("attend le socle, puis montre ou file à l'accueil", () => {
    expect(railSetupArrival("wait", "wait", 100)).toBe("wait");
    expect(railSetupArrival("wait", "show", 100)).toBe("show");
    expect(railSetupArrival("wait", "skip", 100)).toBe("home");
  });

  it("hors ligne ou serveur lent : l'attente est bornée", () => {
    expect(railSetupArrival("wait", "wait", RAIL_SETUP_WAIT_MAX_MS)).toBe("home");
  });

  it("une page montrée le reste jusqu'au choix du profil", () => {
    expect(railSetupArrival("show", "wait", 0)).toBe("show");
    expect(railSetupArrival("show", "skip", 0)).toBe("show");
  });
});

describe("l'étape du propriétaire", () => {
  it("due pour le propriétaire seulement, avec au moins un autre profil", () => {
    expect(railSetupApplyDue(true, 2)).toBe(true);
    expect(railSetupApplyDue(true, 0)).toBe(false);
    expect(railSetupApplyDue(false, 3)).toBe(false);
    expect(railSetupAfterContinue(true)).toBe("apply");
    expect(railSetupAfterContinue(false)).toBe("done");
  });

  it("cocher garde l'ordre de la rangée ; « Appliquer » attend un premier profil", () => {
    const order = ["u1", "u2", "u3"];
    const one = toggleRailSetupTarget([], "u3", order);
    const two = toggleRailSetupTarget(one, "u1", order);
    expect(two).toEqual(["u1", "u3"]);
    expect(toggleRailSetupTarget(two, "u3", order)).toEqual(["u1"]);
    expect(railSetupApplyEnabled([])).toBe(false);
    expect(railSetupApplyEnabled(["u1"])).toBe(true);
  });

  it("le focus d'entrée est le premier profil", () => {
    expect(railSetupApplyEntryKey(2)).toBe(railSetupApplyTileKey(0));
    expect(railSetupApplyEntryKey(0)).toBe(RAIL_SETUP_APPLY_DECLINE_KEY);
  });
});
