import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeSwitchScreen,
  openSwitchScreen,
  readSwitchScreenPhase,
  resetSwitchScreen,
  settleSwitchScreen,
} from "./switchScreenStore";

/** Un élément focalisable de banc : il dit s'il est encore dans le document. */
function trigger(isConnected = true) {
  return { isConnected, focus: vi.fn() } as unknown as HTMLElement & { focus: ReturnType<typeof vi.fn> };
}

describe("l'écran « Changer de profil » : ses phases", () => {
  beforeEach(() => resetSwitchScreen());

  it("s'ouvre en fondu sur la page, puis la couvre ; un second clic n'ouvre rien de plus", () => {
    openSwitchScreen();
    expect(readSwitchScreenPhase()).toBe("opening");
    openSwitchScreen();
    expect(readSwitchScreenPhase()).toBe("opening");
    settleSwitchScreen();
    expect(readSwitchScreenPhase()).toBe("shown");
  });

  it("Annuler pendant l'entrée comme une fois ouvert : la page revient, puis l'écran s'en va", () => {
    openSwitchScreen();
    closeSwitchScreen();
    expect(readSwitchScreenPhase()).toBe("closing");
    settleSwitchScreen();
    expect(readSwitchScreenPhase()).toBe("closed");
    // Fermé, rien ne se referme ni ne s'installe.
    closeSwitchScreen();
    settleSwitchScreen();
    expect(readSwitchScreenPhase()).toBe("closed");
  });

  it("refermé, le focus revient à l'avatar d'où l'on était parti — seulement s'il est encore là", () => {
    const avatar = trigger();
    openSwitchScreen(avatar);
    settleSwitchScreen();
    closeSwitchScreen();
    expect(avatar.focus).not.toHaveBeenCalled();
    settleSwitchScreen();
    expect(avatar.focus).toHaveBeenCalledWith({ preventScroll: true });

    const gone = trigger(false);
    openSwitchScreen(gone);
    closeSwitchScreen();
    settleSwitchScreen();
    expect(gone.focus).not.toHaveBeenCalled();
  });

  it("la coquille démontée (déconnexion) : rien ne reste ouvert, ni de focus à rendre", () => {
    const avatar = trigger();
    openSwitchScreen(avatar);
    settleSwitchScreen();
    resetSwitchScreen();
    expect(readSwitchScreenPhase()).toBe("closed");
    settleSwitchScreen();
    expect(avatar.focus).not.toHaveBeenCalled();
  });
});
