import { beforeEach, describe, expect, it, vi } from "vitest";

/** « Continuer hors ligne » depuis « Qui regarde ? » : hors ligne manuel, au nom du compte, l'application. */

const calls: string[] = [];
let inProfile = false;
vi.mock("../../offline/connectivityStore", () => ({ setManualOffline: (on: boolean) => calls.push(`manual:${on}`) }));
vi.mock("../../auth/profileEnded", () => ({ clearPickerRequest: () => calls.push("clearRequest") }));
vi.mock("./launchState", () => ({ markLaunchPassed: () => calls.push("passed") }));
vi.mock("../../offline/accountFallback", () => ({ fallBackToAccount: () => (calls.push("fallback"), inProfile) }));
vi.mock("../../desktop/bridge", () => ({ invoke: vi.fn() }));
vi.mock("../../desktop/capabilities", () => ({ supportsDownloads: () => true, supportsMusicOffline: () => false }));
vi.mock("../../downloads/api", () => ({ listDownloads: vi.fn(async () => []) }));
vi.mock("../../offline/offlineOwner", () => ({ readOfflineOwner: () => ({ userId: "compte", token: "t" }) }));

const { continueOfflineFromPicker } = await import("./usePickerExits");

describe("« Qui regarde ? » sans serveur — continuer hors ligne (bureau)", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("dans la session du compte : hors ligne manuel, demande oubliée, puis l'application", async () => {
    inProfile = false;
    const enter = vi.fn();
    await continueOfflineFromPicker(enter);
    expect(calls).toEqual(["manual:true", "clearRequest", "passed", "fallback"]);
    expect(enter).toHaveBeenCalledOnce();
  });

  it("une session de profil gardée revient d'abord au compte (la page se recharge, rien d'autre)", async () => {
    inProfile = true;
    const enter = vi.fn();
    await continueOfflineFromPicker(enter);
    expect(calls).toContain("fallback");
    expect(enter).not.toHaveBeenCalled();
  });
});
