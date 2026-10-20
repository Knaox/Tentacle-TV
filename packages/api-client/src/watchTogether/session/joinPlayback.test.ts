import { describe, expect, it, vi } from "vitest";
import type { WtRoomStateDto } from "@tentacle-tv/shared";
import { joinGroupPlayback } from "./joinPlayback";

/**
 * « Rejoindre » d'un membre déjà dans le groupe : la route nouvelle
 * (`/group/arrive`) n'est appelée que si le serveur déclare la capacité —
 * jamais un 404 lu comme « serveur trop ancien » (celui de Damien, l'image
 * `:dev` 45b9dfc1f, ne la déclare pas).
 */

const frozen = { groupId: "g", itemId: "film", paused: true, positionTicks: 1_154_000_000 } as WtRoomStateDto;

function fakes(arrive: () => Promise<WtRoomStateDto> = async () => frozen) {
  const calls: string[] = [];
  return {
    calls,
    arrive: vi.fn(async () => { calls.push("arrive"); return arrive(); }),
    onFrozen: vi.fn(() => { calls.push("frozen"); }),
    navigate: vi.fn((itemId: string) => { calls.push(`navigate:${itemId}`); }),
  };
}

describe("joinGroupPlayback", () => {
  it("serveur qui ne déclare pas `watchTogether.arrival` : aucune route nouvelle, le lecteur s'ouvre comme avant", async () => {
    const f = fakes();
    await joinGroupPlayback({ arrival: false, itemId: "film", ...f });
    expect(f.arrive).not.toHaveBeenCalled();
    expect(f.calls).toEqual(["navigate:film"]);
  });

  it("serveur qui la déclare : la salle se gèle au clic, son état gelé est posé AVANT l'ouverture du lecteur", async () => {
    const f = fakes();
    await joinGroupPlayback({ arrival: true, itemId: "film", ...f });
    expect(f.calls).toEqual(["arrive", "frozen", "navigate:film"]);
    expect(f.onFrozen).toHaveBeenCalledWith(frozen);
  });

  it("l'appel échoue (réseau) : le lecteur s'ouvre quand même ; sans titre, rien", async () => {
    const failing = fakes(async () => { throw new Error("réseau"); });
    await joinGroupPlayback({ arrival: true, itemId: "film", ...failing });
    expect(failing.calls).toEqual(["arrive", "navigate:film"]);
    const none = fakes();
    await joinGroupPlayback({ arrival: true, itemId: null, ...none });
    expect(none.calls).toEqual([]);
  });
});
