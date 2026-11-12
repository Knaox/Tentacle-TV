import { describe, expect, it } from "vitest";
import { WT_CHAT_ADMIN_ID, type WtChatMessageDto } from "@tentacle-tv/shared";
import { THREAD_RUN_GAP_MS, buildThread, firstUnreadId, isEmojiOnly } from "./chatThread";

const at = 1_700_000_000_000;
const message = (id: string, userId: string, offsetMs: number, text = "bonjour"): WtChatMessageDto => ({
  id, userId, username: userId, text, at: at + offsetMs,
});

describe("le fil du chat — les suites", () => {
  it("un même auteur en moins de deux minutes : une suite — le premier porte le nom, le dernier ferme", () => {
    const rows = buildThread([message("a", "lea", 0), message("b", "lea", 10_000), message("c", "lea", 20_000)], "moi");
    expect(rows.map((r) => [r.first, r.last])).toEqual([[true, false], [false, false], [false, true]]);
  });

  it("un autre auteur, ou plus de deux minutes de silence, rouvre une suite", () => {
    const rows = buildThread([
      message("a", "lea", 0), message("b", "marc", 1000), message("c", "marc", 1000 + THREAD_RUN_GAP_MS + 1),
    ], "moi");
    expect(rows.map((r) => r.first)).toEqual([true, true, true]);
    expect(rows.map((r) => r.last)).toEqual([true, true, true]);
  });

  it("les siens sont reconnus ; sans identité (hors séance), aucun", () => {
    const messages = [message("a", "moi", 0), message("b", "lea", 1000)];
    expect(buildThread(messages, "moi").map((r) => r.isSelf)).toEqual([true, false]);
    expect(buildThread(messages, null).map((r) => r.isSelf)).toEqual([false, false]);
  });

  it("la marque des non-lus ne coupe pas une suite en deux : le message marqué ouvre toujours une suite", () => {
    const rows = buildThread([message("a", "lea", 0), message("b", "lea", 5000), message("c", "lea", 9000)], "moi", "b");
    expect(rows.map((r) => [r.first, r.last])).toEqual([[true, true], [true, false], [false, true]]);
  });

  it("un fil vide ne donne rien", () => {
    expect(buildThread([], "moi")).toEqual([]);
  });
});

describe("le fil du chat — les emojis seuls", () => {
  it("un à trois emojis, espaces compris : en grand, sans bulle", () => {
    for (const text of ["😂", "🔥🔥🔥", " 👍 ", "🎬 🍿", "👨‍👩‍👧‍👦", "🇫🇷", "👍🏽"]) expect(isEmojiOnly(text), text).toBe(true);
  });

  it("du texte, quatre emojis ou rien : une bulle ordinaire", () => {
    for (const text of ["", "   ", "ok 😂", "😂 !", "🎬🍿🥤😴", "123", "a", "x".repeat(500)]) expect(isEmojiOnly(text), text).toBe(false);
  });
});

describe("le fil du chat — la marque des non-lus", () => {
  const messages = [message("a", "lea", 0), message("b", "moi", 1000), message("c", "marc", 2000), message("d", "lea", 3000)];

  it("les N derniers messages des AUTRES : la marque passe au-dessus du plus ancien", () => {
    expect(firstUnreadId(messages, 1, "moi")).toBe("d");
    expect(firstUnreadId(messages, 2, "moi")).toBe("c");
    // Le sien ne compte pas : trois non-lus remontent jusqu'au premier message.
    expect(firstUnreadId(messages, 3, "moi")).toBe("a");
  });

  it("rien de non lu, ou un fil vide : aucune marque", () => {
    expect(firstUnreadId(messages, 0, "moi")).toBeNull();
    expect(firstUnreadId([], 4, "moi")).toBeNull();
  });

  it("un compteur plus grand que le fil (fil rogné par le serveur) : le premier message connu", () => {
    expect(firstUnreadId(messages, 40, "moi")).toBe("a");
  });
});

describe("le fil du chat — un message de l'administration", () => {
  // L'administrateur est aussi dans la salle (« moi ») : son message du tableau de bord n'est pas « le sien ».
  const admin: WtChatMessageDto = { ...message("adm", WT_CHAT_ADMIN_ID, 2_000, "Maintenance à 23 h"), username: "moi", from: "admin" };

  it("une ligne à part : ni à soi, ni dans une suite, jamais « emojis seuls »", () => {
    const rows = buildThread([message("a", "lea", 0), admin, message("b", "lea", 4_000, "🔥")], "moi");
    expect(rows[1]).toMatchObject({ isAdmin: true, isSelf: false, first: true, last: true, emojiOnly: false });
    // La suite de Léa est coupée par la note : elle rouvre la sienne après.
    expect(rows[0]).toMatchObject({ isAdmin: false, last: true });
    expect(rows[2]).toMatchObject({ first: true, emojiOnly: true });
    expect(buildThread([{ ...admin, text: "👍" }], "moi")[0]!.emojiOnly).toBe(false);
  });

  it("elle compte parmi les non-lus, même pour l'administrateur qui l'a écrite", () => {
    expect(firstUnreadId([message("a", "moi", 0), admin], 1, "moi")).toBe("adm");
  });
});
