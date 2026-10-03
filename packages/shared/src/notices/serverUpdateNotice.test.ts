import { describe, expect, it } from "vitest";
import { compareAppVersions, isServerOutdated, isServerUpdateMasked, serverUpdateNotice } from "./serverUpdateNotice";

/**
 * « Serveur à mettre à jour » : la comparaison des versions, le serveur en
 * retard sur l'exigence du client, et le masquage « jusqu'à la prochaine mise
 * à jour obligatoire » qui cède dès qu'une exigence plus haute arrive.
 */
describe("serveur à mettre à jour", () => {
  it("compare les versions segment par segment, les manquants valant zéro", () => {
    expect(compareAppVersions("1.22.3", "1.22.10")).toBeLessThan(0);
    expect(compareAppVersions("1.23.0", "1.22.99")).toBeGreaterThan(0);
    expect(compareAppVersions("1.22", "1.22.0")).toBe(0);
    expect(compareAppVersions("v1.22.1", "1.22.1")).toBe(0);
    expect(compareAppVersions("1.22.1-beta", "1.22.1")).toBe(0);
    expect(compareAppVersions("dev", "1.0.0")).toBeLessThan(0);
  });

  it("le serveur est en retard sous l'exigence du client, jamais sur une version inconnue", () => {
    expect(isServerOutdated("1.22.0", "1.22.1")).toBe(true);
    expect(isServerOutdated("1.22.1", "1.22.1")).toBe(false);
    expect(isServerOutdated("1.23.0", "1.22.1")).toBe(false);
    expect(isServerOutdated(null, "1.22.1")).toBe(false);
    expect(isServerOutdated(undefined, "1.22.1")).toBe(false);
  });

  it("le masquage tient tant que l'exigence retenue couvre celle d'aujourd'hui", () => {
    expect(isServerUpdateMasked("1.23.0", "1.23.0")).toBe(true);
    expect(isServerUpdateMasked("1.23.0", "1.22.1")).toBe(true);
    // Une exigence plus haute arrive (client mis à jour) : il cède.
    expect(isServerUpdateMasked("1.23.0", "1.24.0")).toBe(false);
    // Masqué sans marque lisible : au pire, l'avertissement revient.
    expect(isServerUpdateMasked("", "1.23.0")).toBe(false);
    expect(isServerUpdateMasked(null, "1.23.0")).toBe(false);
  });

  it("l'avertissement : admin seulement, serveur en retard, masquage lu et ne couvrant pas l'exigence", () => {
    const base = { serverVersion: "1.22.0", minServer: "1.23.0", isAdmin: true, dismissal: null };
    expect(serverUpdateNotice(base)).toEqual({ outdated: true, masked: false, show: true, mark: "1.23.0" });
    expect(serverUpdateNotice({ ...base, isAdmin: false }).show).toBe(false);
    expect(serverUpdateNotice({ ...base, serverVersion: "1.23.0" }).show).toBe(false);
    // Pas encore lu : rien, plutôt qu'un avertissement qui disparaît aussitôt.
    expect(serverUpdateNotice({ ...base, dismissal: undefined }).show).toBe(false);
    // Masqué jusqu'à la prochaine mise à jour obligatoire…
    expect(serverUpdateNotice({ ...base, dismissal: "1.23.0" })).toMatchObject({ masked: true, show: false });
    // … qui arrive : le client exige plus haut, l'avertissement revient.
    expect(serverUpdateNotice({ ...base, minServer: "1.24.0", dismissal: "1.23.0" }))
      .toEqual({ outdated: true, masked: false, show: true, mark: "1.24.0" });
  });
});
