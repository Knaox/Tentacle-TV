import { describe, expect, it } from "vitest";
import { ACCOUNT_ACCESS_SCREEN_FOCUS, decideAccountAccessScreen } from "./accountAccessScreen";

describe("la page d'un compte bloqué, sur TV", () => {
  it("bloqué : la page remplace les écrans, Retour quitte, jamais le voile hors ligne", () => {
    expect(decideAccountAccessScreen({ blocked: true, profileSession: false, playbackShown: false })).toEqual({
      show: true, hideScreens: true, stopPlayback: false, offlineVeilAllowed: false, exitOnBack: true, action: "unpair",
    });
  });

  it("ne cède pas au lecteur : la lecture est coupée tout de suite", () => {
    expect(decideAccountAccessScreen({ blocked: true, profileSession: false, playbackShown: true })).toMatchObject({
      show: true, stopPlayback: true,
    });
  });

  it("une session de profil de la Famille : « Changer de profil »", () => {
    expect(decideAccountAccessScreen({ blocked: true, profileSession: true, playbackShown: false }).action).toBe("switchProfile");
  });

  it("permis (ou serveur sans la capacité) : l'application comme avant", () => {
    expect(decideAccountAccessScreen({ blocked: false, profileSession: true, playbackShown: true })).toMatchObject({
      show: false, hideScreens: false, stopPlayback: false, offlineVeilAllowed: true, exitOnBack: false,
    });
  });

  it("le focus entre sur l'action, piégé, Menu jamais pris", () => {
    expect(ACCOUNT_ACCESS_SCREEN_FOCUS).toEqual({ entry: "access:action", trapped: true, takesBack: false });
  });
});
