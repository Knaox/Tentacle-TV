import { describe, expect, it } from "vitest";
import { ACCOUNT_ACCESS_SCREEN_FOCUS, accountAccessEntry, decideAccountAccessScreen, type AccountAccessScreenInput } from "./accountAccessScreen";

const BASE: AccountAccessScreenInput = { blocked: true, profileSession: false, soloProfile: false, pairedTheTv: true, playbackShown: false };

describe("la page d'un compte bloqué, sur TV", () => {
  it("bloqué : la page remplace les écrans, Retour quitte, jamais le voile hors ligne", () => {
    expect(decideAccountAccessScreen(BASE)).toEqual({
      show: true, hideScreens: true, stopPlayback: false, offlineVeilAllowed: false, exitOnBack: true, actions: ["unpair"],
    });
  });

  it("ne cède pas au lecteur : la lecture est coupée tout de suite", () => {
    expect(decideAccountAccessScreen({ ...BASE, playbackShown: true })).toMatchObject({ show: true, stopPlayback: true });
  });

  it("session de profil : « Changer de profil » d'abord ; déjumeler seulement pour le compte qui a jumelé la TV", () => {
    expect(decideAccountAccessScreen({ ...BASE, profileSession: true }).actions).toEqual(["switchProfile", "unpair"]);
    expect(decideAccountAccessScreen({ ...BASE, profileSession: true, pairedTheTv: false }).actions).toEqual(["switchProfile"]);
  });

  it("la session « solo » du compte : « Qui regarde ? » ne rendrait que lui — se déconnecter du serveur", () => {
    expect(decideAccountAccessScreen({ ...BASE, profileSession: true, soloProfile: true }).actions).toEqual(["unpair"]);
  });

  it("permis (ou serveur sans la capacité) : l'application comme avant", () => {
    expect(decideAccountAccessScreen({ ...BASE, blocked: false, playbackShown: true })).toMatchObject({
      show: false, hideScreens: false, stopPlayback: false, offlineVeilAllowed: true, exitOnBack: false,
    });
  });

  it("le focus entre sur l'action principale, piégé, Menu jamais pris", () => {
    expect(accountAccessEntry(["switchProfile", "unpair"])).toBe("access:switchProfile");
    expect(accountAccessEntry(["unpair"])).toBe("access:unpair");
    expect(ACCOUNT_ACCESS_SCREEN_FOCUS).toEqual({ trapped: true, takesBack: false });
  });
});
