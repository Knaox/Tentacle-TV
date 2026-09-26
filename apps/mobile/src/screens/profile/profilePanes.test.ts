import { describe, expect, it } from "vitest";
import { PROFILE_PANES, PROFILE_PANE_ROUTES, isPaneAvailable, resolvePane, type PaneContext } from "./profilePanes";

const online: PaneContext = { offline: false, isAdmin: false, offlineVisible: false };
const admin: PaneContext = { ...online, isAdmin: true };
const offline: PaneContext = { offline: true, isAdmin: true, offlineVisible: true };

describe("volets du profil", () => {
  it("chaque volet a sa route plein écran sous /settings", () => {
    for (const id of PROFILE_PANES) expect(PROFILE_PANE_ROUTES[id]).toMatch(/^\/settings\//);
  });

  it("les invitations sont réservées à un administrateur en ligne", () => {
    expect(isPaneAvailable("invites", online)).toBe(false);
    expect(isPaneAvailable("invites", admin)).toBe(true);
    expect(isPaneAvailable("invites", offline)).toBe(false);
  });

  it("hors ligne, il ne reste que ce qui vit sur l'appareil", () => {
    const left = PROFILE_PANES.filter((id) => isPaneAvailable(id, offline));
    expect(left).toEqual(["playback", "data", "onDevice"]);
  });

  it("les réglages hors ligne suivent le droit de garder des titres", () => {
    expect(isPaneAvailable("onDevice", online)).toBe(false);
    expect(isPaneAvailable("onDevice", { ...online, offlineVisible: true })).toBe(true);
  });

  it("sans choix, la tablette ouvre le premier volet disponible", () => {
    expect(resolvePane(null, online)).toBe("personalization");
    expect(resolvePane(null, offline)).toBe("playback");
  });

  it("un volet devenu indisponible cède la place au premier disponible", () => {
    expect(resolvePane("password", online)).toBe("password");
    expect(resolvePane("password", offline)).toBe("playback");
    expect(resolvePane("invites", online)).toBe("personalization");
  });
});
