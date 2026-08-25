import { describe, expect, it } from "vitest";
import { socleLinux } from "./optionsMpv";

describe("socleLinux", () => {
  it("Wayland demande la transmission HDR, X11 ne la demande pas", () => {
    // X.Org n'a pas de gestion de couleur : le signal n'aurait aucun destinataire.
    expect(socleLinux("wayland")["target-colorspace-hint"]).toBe("yes");
    expect(socleLinux("x11")["target-colorspace-hint"]).toBeUndefined();
  });

  it("le contexte GPU suit le montage, jamais l'environnement", () => {
    // Sous XWayland, WAYLAND_DISPLAY et DISPLAY sont posées toutes les deux :
    // laissé libre, mpv prendrait Wayland alors que notre fenêtre est X11.
    expect(socleLinux("wayland")["gpu-context"]).toBe("waylandvk");
    expect(socleLinux("x11")["gpu-context"]).toBe("x11vk");
  });

  it("mpv ne se met en plein écran QUE là où on ne peut pas le placer", () => {
    expect(socleLinux("wayland")["fullscreen"]).toBe("yes");
    expect(socleLinux("x11")["fullscreen"]).toBe("no");
  });

  it("la fenêtre de mpv ne réclame jamais l'activation", () => {
    for (const m of ["wayland", "x11"] as const) {
      expect(socleLinux(m)["focus-on"]).toBe("never");
    }
  });

  it("Vulkan sur les deux montages : libplacebo n'a de HDR que par lui", () => {
    for (const m of ["wayland", "x11"] as const) {
      expect(socleLinux(m)["gpu-api"]).toBe("vulkan");
    }
  });
});
