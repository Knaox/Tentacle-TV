import { beforeEach, describe, expect, it, vi } from "vitest";

// Les envois de `mpv_command_async` (identifiant de réponse, arguments) et le code d'envoi à
// rendre. `vi.hoisted` : la fabrique de `vi.mock` est remontée au-dessus des imports.
const { sent, sending } = vi.hoisted(() => ({
  sent: [] as Array<{ id: number; args: unknown[] }>,
  sending: { code: 0 },
}));

vi.mock("./mpvFfi", () => ({
  mpvApi: () => ({
    commandAsync: (_ctx: unknown, id: number, args: unknown[]) => {
      sent.push({ id, args });
      return sending.code;
    },
  }),
  mpvError: (code: number) => (code >= 0 ? null : `erreur ${code}`),
}));

import { sendCommand, sendCommandForResult, settleAllCommands, settleCommand } from "./mpvCommand";

beforeEach(() => {
  sent.length = 0;
  sending.code = 0;
});

describe("sendCommandForResult — lire le résultat d'une commande asynchrone", () => {
  it("lit le résultat PENDANT la réponse, avec le pointeur de l'évènement", async () => {
    const reply = { node: "mpv_event_command*" };
    const pending = sendCommandForResult("ctx", ["screenshot-raw", "video", "bgra"], (result) => {
      expect(result).toBe(reply);
      return 42;
    });
    expect(sent[0]?.args).toEqual(["screenshot-raw", "video", "bgra", null]);
    settleCommand(sent[0]?.id ?? 0, 0, reply);
    await expect(pending).resolves.toEqual({ error: null, value: 42 });
  });

  it("un échec de mpv ne lit rien et rend son motif", async () => {
    let read = false;
    const pending = sendCommandForResult("ctx", ["screenshot-raw"], () => (read = true));
    settleCommand(sent[0]?.id ?? 0, -12, { any: 1 });
    await expect(pending).resolves.toEqual({ error: "erreur -12", value: null });
    expect(read).toBe(false);
  });

  it("une lecture qui lève est un échec, jamais une exception qui remonte dans la vidange", async () => {
    const pending = sendCommandForResult("ctx", ["screenshot-raw"], () => {
      throw new Error("noeud inattendu");
    });
    expect(() => settleCommand(sent[0]?.id ?? 0, 0, {})).not.toThrow();
    await expect(pending).resolves.toMatchObject({ value: null });
  });

  it("refusée à l'envoi, ou sans mpv : réglée tout de suite", async () => {
    sending.code = -1;
    await expect(sendCommandForResult("ctx", ["x"], () => 1)).resolves.toEqual({ error: "erreur -1", value: null });
    await expect(sendCommandForResult(null, ["x"], () => 1)).resolves.toMatchObject({ value: null });
  });

  it("la destruction de l'instance règle aussi les commandes à résultat ; les simples restent simples", async () => {
    const withResult = sendCommandForResult("ctx", ["screenshot-raw"], () => 1);
    const plain = sendCommand("ctx", ["set", "pause", "yes"]);
    settleAllCommands("instance mpv detruite");
    await expect(withResult).resolves.toMatchObject({ value: null });
    await expect(plain).resolves.toBe("instance mpv detruite");
  });
});
