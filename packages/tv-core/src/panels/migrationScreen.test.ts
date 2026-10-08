import { describe, expect, it } from "vitest";
import { MIGRATION_SCREEN_FOCUS, decideMigrationScreen } from "./migrationScreen";

describe("l'écran d'attente de la migration de la base, sur TV", () => {
  it("migration (en cours ou en échec) : l'écran remplace les écrans, Retour quitte, jamais le voile hors ligne", () => {
    expect(decideMigrationScreen({ migrating: true, playbackShown: false })).toEqual({
      show: true, hideScreens: true, offlineVeilAllowed: false, exitOnBack: true,
    });
  });

  it("cède au lecteur : rien ne couvre ni ne cache la lecture, et toujours pas de voile hors ligne", () => {
    expect(decideMigrationScreen({ migrating: true, playbackShown: true })).toEqual({
      show: false, hideScreens: false, offlineVeilAllowed: false, exitOnBack: false,
    });
  });

  it("base prête, ou serveur qui ne déclare pas la capacité : l'application comme avant", () => {
    expect(decideMigrationScreen({ migrating: false, playbackShown: false })).toEqual({
      show: false, hideScreens: false, offlineVeilAllowed: true, exitOnBack: false,
    });
  });

  it("rien de focalisable, Menu jamais pris", () => {
    expect(MIGRATION_SCREEN_FOCUS).toEqual({ focusable: false, takesBack: false });
  });
});
