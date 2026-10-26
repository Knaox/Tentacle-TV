import { describe, expect, it } from "vitest";
import { movedAdminTarget } from "./adminRedirects";

const modern = { remoteAccess: true };
const older = { remoteAccess: false };

describe("movedAdminTarget", () => {
  it("mène la base et la zone de danger de « Services » à « Système »", () => {
    expect(movedAdminTarget({ pathname: "/admin/services", hash: "#database" }, modern)).toBe("/admin/system#database");
    expect(movedAdminTarget({ pathname: "/admin/services/", hash: "#danger" }, older)).toBe("/admin/system#danger");
  });

  it("mène l'adresse publique et la lecture directe à « Accès à distance » quand le serveur la déclare", () => {
    expect(movedAdminTarget({ pathname: "/admin/services", hash: "#publicurl" }, modern)).toBe("/admin/remote-access#addresses");
    expect(movedAdminTarget({ pathname: "/admin/services", hash: "#directstreaming" }, modern)).toBe("/admin/remote-access#addresses");
  });

  it("laisse l'adresse publique dans « Jellyfin » face à un serveur d'avant", () => {
    expect(movedAdminTarget({ pathname: "/admin/services", hash: "#publicurl" }, older)).toBeNull();
    expect(movedAdminTarget({ pathname: "/admin/services", hash: "#directstreaming" }, older)).toBeNull();
  });

  it("ne touche pas aux ancres restées dans « Jellyfin » ni aux autres pages", () => {
    for (const hash of ["", "#jellyfin", "#compat", "#jellyfin-setup", "#segments"]) {
      expect(movedAdminTarget({ pathname: "/admin/services", hash }, modern)).toBeNull();
    }
    expect(movedAdminTarget({ pathname: "/admin/metadata", hash: "#tmdb" }, modern)).toBeNull();
    expect(movedAdminTarget({ pathname: "/admin/remote-access", hash: "#addresses" }, modern)).toBeNull();
    expect(movedAdminTarget({ pathname: "/admin/system", hash: "#database" }, modern)).toBeNull();
  });
});
