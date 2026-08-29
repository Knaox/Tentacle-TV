/**
 * Le correctif touche à l'état « vu » d'un média : se tromper, ici, c'est
 * démarquer un épisode qu'on vient de finir, ou effacer une reprise. Les trois
 * cas qui comptent sont donc éprouvés — la fin normale, la contradiction, et le
 * média jamais vu — plus les deux réseaux qui échouent.
 */

import { describe, expect, it } from "vitest";
import { clearPlayedWhenResumable, type UserDataClient } from "./resumeOverPlayed";

interface Call {
  path: string;
  init?: RequestInit;
}

/** Un client qui rend l'objet donné et note ce qu'on lui écrit. */
function fakeClient(read: unknown, writeFails = false): UserDataClient & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch<T>(path: string, init?: RequestInit): Promise<T> {
      calls.push({ path, init });
      if (init?.method === "POST") {
        return writeFails ? Promise.reject(new Error("réseau")) : Promise.resolve(undefined as T);
      }
      if (read === null) return Promise.reject(new Error("réseau"));
      return Promise.resolve(read as T);
    },
  };
}

describe("la contradiction « vu et à reprendre »", () => {
  it("ne touche à rien après une fin normale (vu, position à zéro)", async () => {
    const client = fakeClient({ Played: true, PlaybackPositionTicks: 0 });
    expect(await clearPlayedWhenResumable(client, "abc")).toBeNull();
    expect(client.calls).toHaveLength(1);
  });

  it("ne touche à rien sur un média jamais vu", async () => {
    const client = fakeClient({ Played: false, PlaybackPositionTicks: 12_000_000_000 });
    expect(await clearPlayedWhenResumable(client, "abc")).toBeNull();
    expect(client.calls).toHaveLength(1);
  });

  it("démarque en CONSERVANT la position, et renvoie l'objet entier", async () => {
    const client = fakeClient({
      Played: true,
      PlaybackPositionTicks: 1_800_000_000,
      PlayCount: 1,
      IsFavorite: true,
      Rating: 8,
      Key: "abc",
    });

    expect(await clearPlayedWhenResumable(client, "abc")).toBe(1_800_000_000);

    const write = client.calls[1];
    expect(write.path).toBe("/UserItems/abc/UserData");
    expect(write.init?.method).toBe("POST");
    // L'objet ENTIER est renvoyé : ni le favori ni la note ne doivent tomber.
    expect(JSON.parse(String(write.init?.body))).toEqual({
      Played: false,
      PlaybackPositionTicks: 1_800_000_000,
      PlayCount: 1,
      IsFavorite: true,
      Rating: 8,
      Key: "abc",
    });
  });

  it("ne prétend rien quand la lecture échoue", async () => {
    const client = fakeClient(null);
    expect(await clearPlayedWhenResumable(client, "abc")).toBeNull();
    expect(client.calls).toHaveLength(1);
  });

  it("ne prétend rien quand l'écriture échoue", async () => {
    const client = fakeClient({ Played: true, PlaybackPositionTicks: 42 }, true);
    expect(await clearPlayedWhenResumable(client, "abc")).toBeNull();
    expect(client.calls).toHaveLength(2);
  });
});
