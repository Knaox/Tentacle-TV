import { describe, expect, it } from "vitest";
import { NO_ACCOUNT_ABILITIES } from "@tentacle-tv/shared";
import { abilityRefusals } from "./abilityRefusals";

describe("le menu de l'avatar et les droits de la session", () => {
  it("un serveur qui ne dit rien : rien de plus n'est tu", () => {
    expect(abilityRefusals({ kind: "legacy" }).size).toBe(0);
  });

  it("tant que la réponse n'est pas là : aucun geste réservé", () => {
    expect([...abilityRefusals({ kind: "pending" })].sort()).toEqual(["admin", "help", "pair"]);
  });

  it("ce qui est permis se voit, le reste non", () => {
    const abilities = { ...NO_ACCOUNT_ABILITIES, administrator: true, tickets: true };
    expect([...abilityRefusals({ kind: "known", abilities })]).toEqual(["pair"]);
    expect([...abilityRefusals({ kind: "known", abilities: { ...abilities, pairDevices: true } })]).toEqual([]);
  });
});
