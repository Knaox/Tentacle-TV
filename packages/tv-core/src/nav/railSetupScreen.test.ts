import { describe, expect, it } from "vitest";

import { arrangeOnFocus, rowsSelectWhileArranging, startArrange } from "./arrange";
import {
  RAIL_SETUP_CONTINUE_KEY,
  RAIL_SETUP_SKIP_KEY,
  railSetupArrangeReading,
  railSetupBackAction,
  railSetupEntryKey,
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
  railSetupGuardedKeys,
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

describe("routeAfterSession — la page passe avant l'accueil", () => {
  it("la page si elle est due, sinon l'accueil", () => {
    expect(routeAfterSession(true)).toBe("RailSetup");
    expect(routeAfterSession(false)).toBe("Home");
  });
});

describe("l'étape du propriétaire", () => {
  it("due dès qu'il y a un autre profil à qui appliquer (les cibles du propriétaire)", () => {
    expect(railSetupApplyDue(2)).toBe(true);
    expect(railSetupApplyDue(0)).toBe(false);
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

describe("railSetupGuardedKeys — le clic fantôme", () => {
  it("garde chaque cible de la page, lignes, pastilles, pied et étape du propriétaire", () => {
    const guarded = railSetupGuardedKeys();
    for (const key of [railSetupRowKey(0), railSetupMoveKey(42), RAIL_SETUP_CONTINUE_KEY, RAIL_SETUP_SKIP_KEY, railSetupApplyTileKey(0), RAIL_SETUP_APPLY_DECLINE_KEY]) {
      expect(guarded).toContain(key);
    }
  });
});
