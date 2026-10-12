/**
 * Le verdict d'une installation MSIX : ancré sur les valeurs de
 * `StorePackageUpdateState` du SDK Windows, pas sur notre propre constante.
 */

import { describe, expect, it } from "vitest";
import { msixInstallError, opensStorePage } from "./msixInstallState";

describe("msixInstallError", () => {
  it("Completed (3) est le seul succès", () => {
    expect(msixInstallError(3)).toBeNull();
  });

  it("Pending (0) n'est pas un succès", () => {
    expect(msixInstallError(0)).toBe("install-state-0");
  });

  it("les états intermédiaires et OtherError sont des échecs", () => {
    expect(msixInstallError(1)).toBe("install-state-1");
    expect(msixInstallError(2)).toBe("install-state-2");
    expect(msixInstallError(5)).toBe("install-state-5");
  });

  it("un état illisible est un échec", () => {
    expect(msixInstallError(null)).toBe("install-state-null");
    expect(msixInstallError(42)).toBe("install-state-42");
  });

  it("refus, batterie et Wi-Fi ont leur propre code", () => {
    expect(msixInstallError(4)).toBe("install-canceled");
    expect(msixInstallError(6)).toBe("install-low-battery");
    expect(msixInstallError(7)).toBe("install-wifi-required");
    expect(msixInstallError(8)).toBe("install-wifi-required");
  });
});

describe("opensStorePage", () => {
  it("n'ouvre pas le Store quand l'utilisateur peut agir lui-même", () => {
    expect(opensStorePage("install-canceled")).toBe(false);
    expect(opensStorePage("install-low-battery")).toBe(false);
    expect(opensStorePage("install-wifi-required")).toBe(false);
  });

  it("ouvre le Store pour toute autre panne", () => {
    expect(opensStorePage("install-state-5")).toBe(true);
    expect(opensStorePage("install-failed")).toBe(true);
    expect(opensStorePage("store-unavailable")).toBe(true);
  });
});
