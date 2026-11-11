import { describe, expect, it } from "vitest";
import { shouldRequestChatHistory, WT_CREATED_ROOM_EPOCH } from "./chatHistoryRecovery";

describe("shouldRequestChatHistory", () => {
  it("ne redemande rien pour une salle qu'on vient de créer : le serveur n'y a envoyé aucun fil", () => {
    expect(shouldRequestChatHistory({ groupId: "g1", epochAtEntry: WT_CREATED_ROOM_EPOCH, receivedGroupId: null })).toBe(false);
  });

  it("redemande le fil d'un groupe rejoint quand il n'est pas arrivé (l'adhésion a avancé l'epoch)", () => {
    expect(shouldRequestChatHistory({ groupId: "g1", epochAtEntry: 1, receivedGroupId: null })).toBe(true);
    // Le fil reçu est celui d'un AUTRE groupe (l'ancien) : celui-ci manque toujours.
    expect(shouldRequestChatHistory({ groupId: "g1", epochAtEntry: 7, receivedGroupId: "g0" })).toBe(true);
  });

  it("ne redemande rien quand le fil du groupe est arrivé, même vide", () => {
    expect(shouldRequestChatHistory({ groupId: "g1", epochAtEntry: 3, receivedGroupId: "g1" })).toBe(false);
  });
});
