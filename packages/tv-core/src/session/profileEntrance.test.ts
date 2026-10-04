import { describe, expect, it } from "vitest";

import { HOME_ARRIVAL_QUIET_MS, OPENING_HINT_DELAY_MS } from "./profileEntrance";

describe("les délais de l'entrée dans un profil", () => {
  it("l'accueil se tait le temps d'une première lecture ordinaire, jamais une seconde entière", () => {
    expect(HOME_ARRIVAL_QUIET_MS).toBeGreaterThan(OPENING_HINT_DELAY_MS);
    expect(HOME_ARRIVAL_QUIET_MS).toBeLessThan(1000);
  });

  it("« Ouverture de… » ne se dit pas pour un serveur qui répond vite", () => {
    expect(OPENING_HINT_DELAY_MS).toBeGreaterThanOrEqual(300);
  });
});
