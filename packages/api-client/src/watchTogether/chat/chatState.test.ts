import { describe, expect, it } from "vitest";
import { WT_REACTION_GROUP_MS, WT_TYPING_TTL_MS } from "@tentacle-tv/shared";
import { chatReducer, initialChatState, type WtFloatingReaction } from "./chatState";

const fire = (userId: string, emoji: string, addedAt: number, key = `${userId}:${addedAt}`): WtFloatingReaction =>
  ({ key, userId, username: userId.toUpperCase(), emoji, addedAt });

describe("chatReducer — rafales de réactions regroupées, jamais refusées", () => {
  it("la même réaction du même membre en rafale : une seule à l'écran, comptée", () => {
    let state = initialChatState;
    for (let i = 0; i < 5; i += 1) state = chatReducer(state, { type: "reaction_add", reaction: fire("a", "🔥", 1_000 + i * 100) });
    expect(state.reactions).toHaveLength(1);
    expect(state.reactions[0].count).toBe(5);
  });

  it("une autre réaction, un autre membre, ou après une pause : à part", () => {
    let state = chatReducer(initialChatState, { type: "reaction_add", reaction: fire("a", "🔥", 1_000) });
    state = chatReducer(state, { type: "reaction_add", reaction: fire("a", "😂", 1_100) });
    state = chatReducer(state, { type: "reaction_add", reaction: fire("b", "🔥", 1_200) });
    state = chatReducer(state, { type: "reaction_add", reaction: fire("a", "🔥", 1_000 + WT_REACTION_GROUP_MS + 1) });
    expect(state.reactions.map((r) => `${r.userId}${r.emoji}${r.count ?? 1}`)).toEqual(["a🔥1", "a😂1", "b🔥1", "a🔥1"]);
  });
});

describe("chatReducer — « est en train d'écrire »", () => {
  it("arrive, se redit, s'éteint à la fin, au message envoyé, ou seule à son terme", () => {
    let state = chatReducer(initialChatState, { type: "typing", userId: "a", username: "A", typing: true, now: 0 });
    state = chatReducer(state, { type: "typing", userId: "b", username: "B", typing: true, now: 100 });
    expect(state.typing.map((m) => m.username)).toEqual(["A", "B"]);
    state = chatReducer(state, { type: "typing", userId: "a", username: "A", typing: false, now: 200 });
    expect(state.typing.map((m) => m.username)).toEqual(["B"]);
    state = chatReducer(state, {
      type: "message", fromSelf: false,
      message: { id: "g:1", userId: "b", username: "B", text: "salut", at: 300 },
    });
    expect(state.typing).toEqual([]);
    state = chatReducer(state, { type: "typing", userId: "a", username: "A", typing: true, now: 1_000 });
    state = chatReducer(state, { type: "typing_prune", now: 1_000 + WT_TYPING_TTL_MS });
    expect(state.typing).toEqual([]);
  });
});
