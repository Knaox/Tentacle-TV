import { describe, expect, it, vi } from "vitest";
import { combiner, creerRenfortLogind, type Processus } from "./veilleLogind";

function faux() {
  const lances: Array<{ commande: string; args: readonly string[]; p: Processus & { tue: boolean } }> = [];
  const lancer = vi.fn((commande: string, args: readonly string[]) => {
    const p = { tue: false, fini: () => p.tue, kill: () => { p.tue = true; } };
    lances.push({ commande, args, p });
    return p;
  });
  return { lancer, lances };
}

describe("creerRenfortLogind", () => {
  it("bloque l'inactivité ET la veille explicite", () => {
    const { lancer, lances } = faux();
    creerRenfortLogind(lancer).empecher();
    expect(lances[0]?.commande).toBe("systemd-inhibit");
    expect(lances[0]?.args).toContain("--what=idle:sleep");
    expect(lances[0]?.args).toContain("--mode=block");
  });

  it("est idempotent — le lecteur est remonté à chaque épisode", () => {
    const { lancer, lances } = faux();
    const v = creerRenfortLogind(lancer);
    v.empecher(); v.empecher(); v.empecher();
    expect(lances).toHaveLength(1);
  });

  it("relance si le processus est mort de son côté", () => {
    const { lancer, lances } = faux();
    const v = creerRenfortLogind(lancer);
    v.empecher();
    lances[0]!.p.kill();
    v.empecher();
    expect(lances).toHaveLength(2);
  });

  it("libère, et ne libère pas deux fois", () => {
    const { lancer, lances } = faux();
    const v = creerRenfortLogind(lancer);
    v.empecher();
    v.rendre(); v.rendre();
    expect(lances[0]?.p.tue).toBe(true);
  });

  it("s'efface sans bruit là où systemd-inhibit n'existe pas", () => {
    const v = creerRenfortLogind(() => null);
    expect(() => { v.empecher(); v.rendre(); }).not.toThrow();
  });
});

describe("combiner", () => {
  it("n'oublie aucune des deux, dans les deux sens", () => {
    const trace: string[] = [];
    const v = (n: string) => ({ empecher: () => trace.push(`+${n}`), rendre: () => trace.push(`-${n}`) });
    const c = combiner(v("a"), v("b"));
    c.empecher(); c.rendre();
    expect(trace).toEqual(["+a", "+b", "-a", "-b"]);
  });
});
