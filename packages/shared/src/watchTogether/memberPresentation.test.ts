import { describe, expect, it } from "vitest";
import type { WtMemberDto } from "../types/watchTogether";
import { wtMemberStatus, wtMemberStatusLabelKey, WT_QUICK_REACTIONS } from "./memberPresentation";

const member = (patch: Partial<WtMemberDto> = {}): WtMemberDto => ({
  userId: "a", username: "A", hasAvatar: false, online: true, inPlayback: false, buffering: false,
  playbackError: false, isHost: false, joinedAt: 0, ...patch,
});

describe("ce qu'on dit d'un membre", () => {
  it("hors ligne l'emporte, puis l'échec, le chargement, la lecture", () => {
    expect(wtMemberStatus(member({ online: false, playbackError: true }))).toBe("offline");
    expect(wtMemberStatus(member({ playbackError: true, buffering: true }))).toBe("error");
    expect(wtMemberStatus(member({ buffering: true, inPlayback: true }))).toBe("buffering");
    expect(wtMemberStatus(member({ inPlayback: true }))).toBe("watching");
    expect(wtMemberStatus(member())).toBe("none");
  });

  it("le libellé : l'échec d'abord, puis en ligne / hors ligne quand il ne regarde pas", () => {
    expect(wtMemberStatusLabelKey(member({ playbackError: true }))).toBe("cantPlay");
    expect(wtMemberStatusLabelKey(member({ buffering: true }))).toBe("bufferingStatus");
    expect(wtMemberStatusLabelKey(member({ inPlayback: true }))).toBe("watching");
    expect(wtMemberStatusLabelKey(member())).toBe("online");
    expect(wtMemberStatusLabelKey(member({ online: false }))).toBe("offline");
  });

  it("six réactions rapides, chacune acceptée par le serveur (≤ 16 unités)", () => {
    expect(WT_QUICK_REACTIONS).toHaveLength(6);
    for (const emoji of WT_QUICK_REACTIONS) expect(emoji.length).toBeLessThanOrEqual(16);
  });
});
