import { afterEach, describe, expect, it } from "vitest";
import { decideSession, readSessionChoice, desktopSession } from "./graphicsSession";

const WAYLAND = { XDG_SESSION_TYPE: "wayland", WAYLAND_DISPLAY: "wayland-0", DISPLAY: ":0" };
const X11 = { XDG_SESSION_TYPE: "x11", DISPLAY: ":0" };

afterEach(() => { delete process.env["TENTACLE_LINUX_SESSION"]; });

describe("sessionDuBureau", () => {
  it("ne conclut pas X11 sur une session Wayland, où DISPLAY est posé aussi", () => {
    expect(desktopSession(WAYLAND)).toBe("wayland");
  });

  it("reconnaît une vraie session X11", () => {
    expect(desktopSession(X11)).toBe("x11");
  });

  it("suit WAYLAND_DISPLAY quand le compositeur ne pose pas XDG_SESSION_TYPE", () => {
    expect(desktopSession({ WAYLAND_DISPLAY: "wayland-1" })).toBe("wayland");
  });

  it("laisse XDG_SESSION_TYPE=x11 contredire un WAYLAND_DISPLAY résiduel", () => {
    expect(desktopSession({ ...X11, WAYLAND_DISPLAY: "wayland-0" })).toBe("x11");
  });

  it("rend « inconnue » sans aucun affichage", () => {
    expect(desktopSession({})).toBe("inconnue");
  });
});

describe("deciderSession", () => {
  it("en auto, n'impose rien à Electron — son repli vers X11 doit rester possible", () => {
    expect(decideSession(WAYLAND, "auto")).toMatchObject({ ozone: null, montage: "wayland" });
    expect(decideSession(X11, "auto")).toMatchObject({ ozone: null, montage: "x11" });
  });

  it("« x11 » impose XWayland et le montage fenêtré", () => {
    expect(decideSession(WAYLAND, "x11")).toMatchObject({ ozone: "x11", montage: "x11" });
  });

  it("« wayland » n'est honoré que s'il y a un compositeur", () => {
    expect(decideSession(WAYLAND, "wayland")).toMatchObject({ ozone: "wayland", montage: "wayland" });
    // Transporté depuis un autre poste : ramené à X11 plutôt que de ne rien ouvrir.
    expect(decideSession(X11, "wayland")).toMatchObject({ ozone: "x11", montage: "x11" });
  });

  it("sans affichage connu, retombe sur le montage X11", () => {
    expect(decideSession({}, "auto").montage).toBe("x11");
  });
});

describe("lireChoixSession", () => {
  it("vaut « auto » quand le fichier n'existe pas — le premier lancement", () => {
    expect(readSessionChoice("/inexistant/xyz")).toBe("auto");
  });

  it("TENTACLE_LINUX_SESSION court-circuite le réglage de l'utilisateur", () => {
    process.env["TENTACLE_LINUX_SESSION"] = "x11";
    expect(readSessionChoice("/inexistant/xyz")).toBe("x11");
  });

  it("ignore une valeur d'environnement qui n'est pas un choix connu", () => {
    process.env["TENTACLE_LINUX_SESSION"] = "mir";
    expect(readSessionChoice("/inexistant/xyz")).toBe("auto");
  });
});
