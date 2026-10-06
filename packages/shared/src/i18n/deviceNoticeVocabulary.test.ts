import { describe, expect, it } from "vitest";
import fr from "./locales/fr/player";
import en from "./locales/en/player";
import { DEVICE_NOTICES } from "../playback/devicePlaybackVerdict";

/**
 * Le message discret du lecteur quand l'appareil ne décode pas un format et
 * que le serveur le convertit (décision du 07/10 pour l'AV1) : chaque message
 * du verdict a sa phrase, dans les deux langues, et elle dit le format.
 */
describe("messages du verdict de l'appareil", () => {
  it.each(DEVICE_NOTICES)("« %s » existe en français et en anglais", (notice) => {
    expect(fr.deviceNotice[notice].trim()).not.toBe("");
    expect(en.deviceNotice[notice].trim()).not.toBe("");
  });

  it("l'AV1 : le format est nommé, et c'est le serveur qui convertit", () => {
    expect(fr.deviceNotice.av1Converted).toBe("Cet appareil ne lit pas l'AV1 : le serveur convertit");
    expect(en.deviceNotice.av1Converted).toContain("AV1");
    expect(en.deviceNotice.av1Converted.toLowerCase()).toContain("server");
  });
});
