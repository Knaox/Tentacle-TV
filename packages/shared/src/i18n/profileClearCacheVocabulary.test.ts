import { describe, expect, it } from "vitest";
import fr from "./locales/fr/profile";
import en from "./locales/en/profile";

/**
 * « Vider le cache et réinitialiser » : deux effets, deux phrases (recette du
 * 14/10). Le mobile vide TOUT et repart de l'adresse du serveur
 * (`clearCacheMessage`) ; le web, le bureau et le miroir gardent la session et
 * le serveur (`clearLocalCache`) — leur confirmation ne demande donc ni
 * l'adresse ni une reconnexion, et dit ce qui revient à zéro.
 */
describe("profile — vider le cache", () => {
  it("le web garde la session : sa confirmation le dit, sans adresse à ressaisir", () => {
    expect(fr.clearCacheKeepsSessionMessage).toMatch(/session et l'adresse du serveur sont conservées/);
    expect(fr.clearCacheKeepsSessionMessage).not.toMatch(/re-?saisir|reconnecter/);
    expect(en.clearCacheKeepsSessionMessage).toMatch(/session and server address are kept/);
    expect(en.clearCacheKeepsSessionMessage).not.toMatch(/re-?enter|sign in again/);
  });

  it("elle dit ce qui revient à zéro : les réglages de l'appareil et les nouveautés", () => {
    expect(fr.clearCacheKeepsSessionMessage).toMatch(/réglages de cet appareil/);
    expect(fr.clearCacheKeepsSessionMessage).toMatch(/nouveautés/);
    expect(en.clearCacheKeepsSessionMessage).toMatch(/device's settings/);
    expect(en.clearCacheKeepsSessionMessage).toMatch(/What's New/);
  });

  it("le mobile repart de l'adresse du serveur : sa phrase le dit toujours", () => {
    expect(fr.clearCacheMessage).toMatch(/adresse de votre serveur/);
    expect(en.clearCacheMessage).toMatch(/server address/);
  });
});
