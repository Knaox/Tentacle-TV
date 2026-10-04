/**
 * Les écritures d'un appareil à travers le proxy : tout ce qu'envoient les TV
 * livrées passe (relevé du 2026-10-04 : Apple TV, Android TV depuis
 * tv-v1.0.0, LG), rien d'autre — surtout pas une suppression de titre.
 */

import { describe, expect, it } from "vitest";
import { isDeviceWriteAllowed } from "./deviceWrites";

const ITEM = "9f1c2b3a4d5e6f708192a3b4c5d6e7f8";
const USER = "0123456789abcdef0123456789abcdef";

describe("ce qu'envoient les TV livrées", () => {
  it.each([
    ["POST", `Items/${ITEM}/PlaybackInfo`],
    ["POST", "Sessions/Playing"],
    ["POST", "Sessions/Playing/Progress"],
    ["POST", "Sessions/Playing/Stopped"],
    ["POST", `UserItems/${ITEM}/UserData`],
    ["POST", `Users/${USER}/PlayedItems/${ITEM}`],
    ["DELETE", `Users/${USER}/PlayedItems/${ITEM}`],
    ["POST", `Users/${USER}/FavoriteItems/${ITEM}`],
    ["DELETE", `Users/${USER}/FavoriteItems/${ITEM}`],
    ["POST", `Users/${USER}/Items/${ITEM}/Rating`],
    ["DELETE", `Users/${USER}/Items/${ITEM}/Rating`],
    ["DELETE", "Videos/ActiveEncodings"],
    ["delete", "videos/activeencodings"],
  ])("%s %s passe", (method, path) => {
    expect(isDeviceWriteAllowed(method, path)).toBe(true);
  });

  it("laisse toute lecture à la liste blanche des chemins", () => {
    expect(isDeviceWriteAllowed("GET", `Users/${USER}/Items/${ITEM}`)).toBe(true);
    expect(isDeviceWriteAllowed("HEAD", `Videos/${ITEM}/stream`)).toBe(true);
  });
});

describe("ce qu'un appareil n'écrit jamais", () => {
  it.each([
    ["DELETE", `Users/${USER}/Items/${ITEM}`],
    ["DELETE", `Items/${ITEM}`],
    ["POST", `Items/${ITEM}`],
    ["POST", `Items/${ITEM}/Images/Primary`],
    ["DELETE", `Items/${ITEM}/Images/Primary/0`],
    ["POST", `Items/${ITEM}/Collections`],
    ["POST", `Users/${USER}/Images/Primary`],
    ["POST", "DisplayPreferences/usersettings"],
    ["POST", `Videos/${ITEM}/PlaybackInfo`],
    ["DELETE", "Sessions/Playing"],
    ["PUT", `Users/${USER}/FavoriteItems/${ITEM}`],
    ["POST", "Users/AuthenticateByName"],
  ])("%s %s est refusé", (method, path) => {
    expect(isDeviceWriteAllowed(method, path)).toBe(false);
  });
});
