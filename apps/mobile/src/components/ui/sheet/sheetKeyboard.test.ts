import { describe, expect, it } from "vitest";
import { keyboardCover, liftedSnapHeights, sheetKeyboardLift, SHEET_KEYBOARD_TOP_GAP } from "./sheetKeyboard";

describe("keyboardCover", () => {
  it("iOS : la hauteur du clavier telle quelle", () => {
    expect(keyboardCover("ios", 336, 34)).toBe(336);
  });

  it("Android : la barre de navigation, que React Native retire, est rendue", () => {
    expect(keyboardCover("android", 300, 48)).toBe(348);
  });

  it("clavier absent ou flottant : rien", () => {
    expect(keyboardCover("ios", 0, 34)).toBe(0);
    expect(keyboardCover("android", Number.NaN, 48)).toBe(0);
  });
});

describe("sheetKeyboardLift", () => {
  it("fenêtre intacte (bord à bord, iOS) : la feuille monte de tout le clavier", () => {
    expect(sheetKeyboardLift(336, 844, 844)).toBe(336);
  });

  it("fenêtre déjà rétrécie par le système : jamais soulevée deux fois", () => {
    expect(sheetKeyboardLift(348, 900, 552)).toBe(0);
  });

  it("rétrécie à moitié : seul le reste", () => {
    expect(sheetKeyboardLift(348, 900, 700)).toBe(148);
  });

  it("sans clavier : rien", () => {
    expect(sheetKeyboardLift(0, 844, 844)).toBe(0);
  });
});

describe("liftedSnapHeights", () => {
  it("sans clavier : les crans d'origine", () => {
    expect(liftedSnapHeights([422, 633], 844, 0, 47)).toEqual([422, 633]);
  });

  it("avec clavier : bornés à la place au-dessus de lui, sous la zone sûre", () => {
    const room = 844 - 336 - 47 - SHEET_KEYBOARD_TOP_GAP;
    expect(liftedSnapHeights([500, 633], 844, 336, 47)).toEqual([room, room]);
  });

  it("un premier cran qui tient reste tel quel", () => {
    expect(liftedSnapHeights([300, 633], 844, 336, 47)).toEqual([300, 844 - 336 - 47 - SHEET_KEYBOARD_TOP_GAP]);
  });
});
