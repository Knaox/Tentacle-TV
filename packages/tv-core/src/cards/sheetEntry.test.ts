import { describe, expect, it } from "vitest";
import {
  SHEET_GUIDE_MEMORY,
  absentSheetEntry,
  firstPictoOf,
  sheetActionsTarget,
  sheetEntryNow,
  sheetEntryOf,
  sheetHeaderTarget,
  sheetLockKeys,
  sheetRatingOf,
  sheetScaleTarget,
} from "./sheetEntry";
import { SCALE_FOCUS_KEYS, isSheetGuardedKey, scaleAimOf, scaleFocusKey, sheetActionKey } from "./sheetKeys";

const PICTOS = [{ kind: "play" }, { kind: "watchlist" }, { kind: "favorite" }];

describe("les clés du grand panneau", () => {
  it("nomment chaque cran, le retrait et les pictos", () => {
    expect(scaleFocusKey(7)).toBe("sheet:scale:7");
    expect(scaleFocusKey(null)).toBe("sheet:scale:remove");
    expect(sheetActionKey("watched")).toBe("sheet:action:watched");
    expect(SCALE_FOCUS_KEYS).toHaveLength(11);
    expect(SCALE_FOCUS_KEYS[10]).toBe("sheet:scale:remove");
  });

  it("relisent ce que vise une clé de l'échelle, et rien d'autre", () => {
    expect(scaleAimOf("sheet:scale:3")).toBe(3);
    expect(scaleAimOf("sheet:scale:remove")).toBe("remove");
    expect(scaleAimOf("sheet:scale:11")).toBeNull();
    expect(scaleAimOf("sheet:scale:2.5")).toBeNull();
    expect(scaleAimOf("sheet:action:play")).toBeNull();
    expect(scaleAimOf(null)).toBeNull();
  });

  it("gardent l'échelle, les pictos et la croix contre le clic fantôme, pas les groupes", () => {
    expect(isSheetGuardedKey("sheet:scale:5")).toBe(true);
    expect(isSheetGuardedKey("sheet:scale:remove")).toBe(true);
    expect(isSheetGuardedKey("sheet:action:play")).toBe(true);
    expect(isSheetGuardedKey("sheet:close")).toBe(true);
    expect(isSheetGuardedKey("sheet:scale")).toBe(false);
    expect(isSheetGuardedKey("sheet:header")).toBe(false);
    expect(isSheetGuardedKey("sheet:season:2")).toBe(false);
  });
});

describe("l'entrée du grand panneau", () => {
  it("se pose sur la note posée", () => {
    expect(sheetEntryOf({ current: 7 }, PICTOS)).toBe("sheet:scale:7");
  });

  it("sans note posée, sur 5/10 — jamais un bout de l'échelle", () => {
    expect(sheetEntryOf({ current: null }, PICTOS)).toBe("sheet:scale:5");
  });

  it("attend tant que la note se résout", () => {
    expect(sheetEntryOf({ current: null, pending: true }, PICTOS)).toBeNull();
    expect(sheetEntryOf({ current: 4, pending: true }, PICTOS)).toBeNull();
  });

  it("sans note possible, sur le premier picto, sinon la croix", () => {
    expect(sheetEntryOf(null, PICTOS)).toBe("sheet:action:play");
    expect(sheetEntryOf(undefined, [])).toBe("sheet:close");
    expect(firstPictoOf([])).toBe("sheet:close");
  });

  it("le filet écoulé, tombe sur le premier picto même si la note se résout encore", () => {
    expect(sheetEntryNow({ current: null, pending: true }, PICTOS, false)).toBeNull();
    expect(sheetEntryNow({ current: null, pending: true }, PICTOS, true)).toBe("sheet:action:play");
    expect(sheetEntryNow({ current: 8 }, PICTOS, true)).toBe("sheet:scale:8");
  });

  it("d'un titre absent : attend son état ou le filet, puis « Demander », sinon la croix", () => {
    expect(absentSheetEntry([{ kind: "request" }], false, false)).toBeNull();
    expect(absentSheetEntry([{ kind: "request" }], true, false)).toBe("sheet:action:request");
    expect(absentSheetEntry([], false, true)).toBe("sheet:close");
  });

  it("verrouille toutes les cibles du panneau, croix comprise", () => {
    const keys = sheetLockKeys(PICTOS);
    expect(keys).toHaveLength(11 + 3 + 1);
    expect(keys.slice(11)).toEqual(["sheet:action:play", "sheet:action:watchlist", "sheet:action:favorite", "sheet:close"]);
  });
});

describe("la note du panneau", () => {
  const known = { target: true, resolving: false, itemLoading: false };

  it("est la note posée, ou aucune, une fois sa cible et la liste des notes connues", () => {
    expect(sheetRatingOf({ ...known, score: 7 })).toEqual({ current: 7, pending: false });
    expect(sheetRatingOf({ ...known, score: null })).toEqual({ current: null, pending: false });
  });

  it("attend la liste des notes", () => {
    expect(sheetRatingOf({ ...known, score: undefined })).toEqual({ current: null, pending: true });
  });

  it("attend sa cible : « pas encore su » n'est pas « non notable »", () => {
    expect(sheetRatingOf({ target: false, resolving: true, itemLoading: false, score: null })).toEqual({ current: null, pending: true });
    expect(sheetRatingOf({ target: false, resolving: false, itemLoading: true, score: 6 })).toEqual({ current: 6, pending: true });
  });

  it("n'existe pas quand rien ne se note", () => {
    expect(sheetRatingOf({ target: false, resolving: false, itemLoading: false, score: undefined })).toBeNull();
  });
});

describe("les guides des trois groupes", () => {
  it("l'en-tête ne mène à la croix qu'une fois le verrou d'entrée levé", () => {
    expect(sheetHeaderTarget(false)).toBeNull();
    expect(sheetHeaderTarget(true)).toBe("sheet:close");
  });

  it("l'échelle mène au cran retenu : la note posée, sinon 5", () => {
    expect(sheetScaleTarget({ current: 9 })).toBe("sheet:scale:9");
    expect(sheetScaleTarget({ current: null })).toBe("sheet:scale:5");
    expect(sheetScaleTarget(null)).toBe("sheet:scale:5");
  });

  it("les pictos entrent par le premier, puis par le dernier visité (mémoire du guide)", () => {
    expect(sheetActionsTarget(PICTOS)).toBe("sheet:action:play");
    expect(sheetActionsTarget([])).toBeNull();
    expect(SHEET_GUIDE_MEMORY).toEqual({ header: false, scale: false, actions: true });
  });
});
