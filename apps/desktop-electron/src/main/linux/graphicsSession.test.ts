import { afterEach, describe, expect, it } from "vitest";
import { decideSession, readSessionChoice, desktopSession, ozoneRelaunchArgs, SESSION_RELAUNCH_FLAG } from "./graphicsSession";

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

describe("auto sous GNOME et wlroots : XWayland, sauf écran HDR", () => {
  const GNOME = { ...WAYLAND, XDG_CURRENT_DESKTOP: "GNOME" };
  const KDE = { ...WAYLAND, XDG_CURRENT_DESKTOP: "KDE" };
  const SDR = { hdrDisplay: false, xwaylandAutoBlocked: false };

  it("GNOME sans écran HDR prend XWayland : lecture fenêtrée", () => {
    expect(decideSession(GNOME, "auto", SDR)).toMatchObject({ ozone: "x11", montage: "x11", xwaylandAuto: true });
  });

  it("sway (aucun XDG_CURRENT_DESKTOP KDE) aussi", () => {
    expect(decideSession({ ...WAYLAND, XDG_CURRENT_DESKTOP: "sway" }, "auto", SDR).montage).toBe("x11");
  });

  it("un écran HDR branché garde Wayland, et le HDR", () => {
    expect(decideSession(GNOME, "auto", { ...SDR, hdrDisplay: true }))
      .toMatchObject({ ozone: null, montage: "wayland", xwaylandAuto: false });
  });

  it("KDE garde Wayland : la colle KWin y tient la lecture fenêtrée", () => {
    expect(decideSession(KDE, "auto", SDR).montage).toBe("wayland");
    expect(decideSession({ ...WAYLAND, XDG_CURRENT_DESKTOP: "kde:plasma" }, "auto", SDR).montage).toBe("wayland");
  });

  it("sans XWayland (DISPLAY vide), Wayland reste le seul possible", () => {
    expect(decideSession({ ...GNOME, DISPLAY: "" }, "auto", SDR).montage).toBe("wayland");
  });

  it("un XWayland qui n'a jamais affiché n'est plus retenté", () => {
    expect(decideSession(GNOME, "auto", { ...SDR, xwaylandAutoBlocked: true }).montage).toBe("wayland");
  });

  it("un choix explicite l'emporte sur la règle", () => {
    expect(decideSession(GNOME, "wayland", SDR)).toMatchObject({ montage: "wayland", xwaylandAuto: false });
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

describe("ozoneRelaunchArgs", () => {
  const ARGV = ["/opt/tentacle/tentacle-tv", "--remote-debugging-port=9334"];

  it("XWayland sous une session Wayland : relance, le drapeau sur la ligne de commande", () => {
    expect(ozoneRelaunchArgs(decideSession(WAYLAND, "x11"), ARGV))
      .toEqual(["--remote-debugging-port=9334", "--ozone-platform=x11", SESSION_RELAUNCH_FLAG]);
  });

  it("le second processus trouve le drapeau : pas de boucle", () => {
    const relaunched = ["/opt/tentacle/tentacle-tv", ...ozoneRelaunchArgs(decideSession(WAYLAND, "x11"), ARGV)!];
    expect(ozoneRelaunchArgs(decideSession(WAYLAND, "x11"), relaunched)).toBeNull();
  });

  it("auto n'impose rien, et Wayland imposé sous Wayland est déjà ce qu'Electron a pris", () => {
    expect(ozoneRelaunchArgs(decideSession(WAYLAND, "auto"), ARGV)).toBeNull();
    expect(ozoneRelaunchArgs(decideSession(WAYLAND, "wayland"), ARGV)).toBeNull();
  });

  it("X11 sous une vraie session X11 : rien à relancer", () => {
    expect(ozoneRelaunchArgs(decideSession(X11, "x11"), ARGV)).toBeNull();
  });

  it("remplace un drapeau contraire au lieu d'en ajouter un second", () => {
    expect(ozoneRelaunchArgs(decideSession(WAYLAND, "x11"), [...ARGV, "--ozone-platform=wayland"]))
      .toEqual(["--remote-debugging-port=9334", "--ozone-platform=x11", SESSION_RELAUNCH_FLAG]);
  });

  it("un drapeau X11 hérité d'une relance, puis retour à auto : relance SANS drapeau", () => {
    const inherited = [...ARGV, "--ozone-platform=x11", SESSION_RELAUNCH_FLAG];
    expect(ozoneRelaunchArgs(decideSession(WAYLAND, "auto"), inherited))
      .toEqual(["--remote-debugging-port=9334", SESSION_RELAUNCH_FLAG]);
  });
});
