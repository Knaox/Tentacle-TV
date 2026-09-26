import { describe, expect, it } from "vitest";
import { isPaneAvailable, isProfileSplit, masterWidth, parsePaneParam, resolvePane } from "./panes";

const online = { offline: false, isAdmin: false };
const admin = { offline: false, isAdmin: true };
const offline = { offline: true, isAdmin: true };

describe("volets du profil miroir", () => {
  it("les invitations ne se montrent qu'à un administrateur en ligne", () => {
    expect(isPaneAvailable("invites", online)).toBe(false);
    expect(isPaneAvailable("invites", admin)).toBe(true);
    expect(isPaneAvailable("invites", offline)).toBe(false);
  });

  it("hors ligne, seuls Lecture et Données restent", () => {
    expect(isPaneAvailable("playback", offline)).toBe(true);
    expect(isPaneAvailable("data", offline)).toBe(true);
    expect(isPaneAvailable("personalization", offline)).toBe(false);
    expect(isPaneAvailable("password", offline)).toBe(false);
    expect(isPaneAvailable("devices", offline)).toBe(false);
  });

  it("le volet par défaut est le premier disponible, le choix tient s'il existe encore", () => {
    expect(resolvePane(null, online)).toBe("personalization");
    expect(resolvePane(null, offline)).toBe("playback");
    expect(resolvePane("password", online)).toBe("password");
    expect(resolvePane("invites", online)).toBe("personalization");
  });

  it("les anciennes routes /settings/* retombent sur un volet ou sur le profil", () => {
    expect(parsePaneParam("playback")).toBe("playback");
    expect(parsePaneParam("security")).toBe("password");
    expect(parsePaneParam("appearance")).toBeNull();
    expect(parsePaneParam("downloads")).toBeNull();
    expect(parsePaneParam("nimporte")).toBeNull();
    expect(parsePaneParam(undefined)).toBeNull();
  });

  it("maître-détail dès 720 de largeur utile sur tablette", () => {
    expect(isProfileSplit(true, 744, 0)).toBe(true);
    expect(isProfileSplit(true, 780, 76)).toBe(false);
    expect(isProfileSplit(false, 1200, 0)).toBe(false);
    expect(masterWidth(744)).toBe(320);
    expect(masterWidth(1024)).toBe(348);
    expect(masterWidth(1366)).toBe(400);
  });
});
