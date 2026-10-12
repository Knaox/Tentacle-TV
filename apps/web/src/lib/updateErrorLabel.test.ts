import { describe, expect, it } from "vitest";
import { updateErrorLabel } from "./updateErrorLabel";

/** Le rejet tel qu'Electron le rend à la page. */
function fromShell(code: string): Error {
  return new Error(`Error invoking remote method 'tentacle:download_and_install_msix_update': Error: ${code}`);
}

describe("updateErrorLabel", () => {
  it("reconnaît un code malgré le préfixe d'Electron", () => {
    expect(updateErrorLabel(fromShell("store-page-opened"))).toBe("notifications:updateStorePageOpened");
  });

  it("donne un message à part au refus, à la batterie et au Wi-Fi", () => {
    expect(updateErrorLabel(fromShell("install-canceled"))).toBe("notifications:updateInstallCanceled");
    expect(updateErrorLabel(fromShell("install-low-battery"))).toBe("notifications:updateLowBattery");
    expect(updateErrorLabel(fromShell("install-wifi-required"))).toBe("notifications:updateWifiRequired");
  });

  it("ramène tout autre état d'installation au refus générique", () => {
    expect(updateErrorLabel(fromShell("install-state-5"))).toBe("notifications:updateInstallRefused");
  });

  it("accepte un code nu, et rend un inconnu sans préfixe", () => {
    expect(updateErrorLabel(new Error("no-update"))).toBe("notifications:updateNoLongerAvailable");
    expect(updateErrorLabel(fromShell("disque plein"))).toBe("disque plein");
  });
});
