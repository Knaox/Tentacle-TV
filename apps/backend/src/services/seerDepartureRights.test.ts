/**
 * Le départ d'une demande (« … est en route ») ne part en push que si le
 * demandeur voit ENCORE le titre : une restriction posée depuis la demande
 * (au bureau, par la famille) le lui cache sur l'écran verrouillé aussi.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { filtered: true, rowVisible: true, allowed: true, content: { tmdbId: 680, mediaType: "movie", title: "Pulp Fiction" } as { tmdbId: number; mediaType: string; title: string } | null };

vi.mock("../notifications/notificationRights", () => ({
  notificationsFiltered: async () => state.filtered,
  visibleNotificationRows: async (_userId: string, rows: unknown[]) => (state.rowVisible ? rows : []),
}));
vi.mock("./reco/recoRights", () => ({ titleAllowedFor: vi.fn(async () => state.allowed) }));
vi.mock("./seerAvailabilityGuard", () => ({ resolveSeerContent: async () => state.content }));

import { departurePushAllowed } from "./seerDepartureRights";
import { titleAllowedFor } from "./reco/recoRights";

const row = { jellyfinUserId: "enfant", refId: "r1", title: "Pulp Fiction", target: null };

beforeEach(() => {
  Object.assign(state, { filtered: true, rowVisible: true, allowed: true, content: { tmdbId: 680, mediaType: "movie", title: "Pulp Fiction" } });
  vi.mocked(titleAllowedFor).mockClear();
});

describe("départ d'une demande face aux droits d'aujourd'hui", () => {
  it("un compte libre la reçoit sans autre question", async () => {
    state.filtered = false;
    state.allowed = false;
    expect(await departurePushAllowed(row, [])).toBe(true);
    expect(titleAllowedFor).not.toHaveBeenCalled();
  });

  it("un compte restreint la reçoit s'il voit le titre", async () => {
    expect(await departurePushAllowed(row, [])).toBe(true);
    expect(titleAllowedFor).toHaveBeenCalledWith("enfant", { mediaType: "movie", tmdbId: 680 });
  });

  it("titre caché depuis la demande : pas de push", async () => {
    state.allowed = false;
    expect(await departurePushAllowed(row, [])).toBe(false);
  });

  it("cible de la ligne cachée : pas de push", async () => {
    state.rowVisible = false;
    expect(await departurePushAllowed(row, [])).toBe(false);
  });

  it("titre introuvable pour un compte restreint : fermé à l'échec", async () => {
    state.content = null;
    expect(await departurePushAllowed(row, [])).toBe(false);
  });
});
