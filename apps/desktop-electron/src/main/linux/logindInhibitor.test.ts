import { describe, expect, it, vi } from "vitest";
import { combine, createLogindBackup, type ChildProcess } from "./logindInhibitor";

function fake() {
  const launched: Array<{ command: string; args: readonly string[]; p: ChildProcess & { killed: boolean } }> = [];
  const launch = vi.fn((command: string, args: readonly string[]) => {
    const p = { killed: false, done: () => p.killed, kill: () => { p.killed = true; } };
    launched.push({ command, args, p });
    return p;
  });
  return { launch, launched };
}

describe("creerRenfortLogind", () => {
  it("bloque l'inactivité ET la veille explicite", () => {
    const { launch, launched } = fake();
    createLogindBackup(launch).prevent();
    expect(launched[0]?.command).toBe("systemd-inhibit");
    expect(launched[0]?.args).toContain("--what=idle:sleep");
    expect(launched[0]?.args).toContain("--mode=block");
  });

  it("est idempotent — le lecteur est remonté à chaque épisode", () => {
    const { launch, launched } = fake();
    const v = createLogindBackup(launch);
    v.prevent(); v.prevent(); v.prevent();
    expect(launched).toHaveLength(1);
  });

  it("relance si le processus est mort de son côté", () => {
    const { launch, launched } = fake();
    const v = createLogindBackup(launch);
    v.prevent();
    launched[0]!.p.kill();
    v.prevent();
    expect(launched).toHaveLength(2);
  });

  it("libère, et ne libère pas deux fois", () => {
    const { launch, launched } = fake();
    const v = createLogindBackup(launch);
    v.prevent();
    v.release(); v.release();
    expect(launched[0]?.p.killed).toBe(true);
  });

  it("s'efface sans bruit là où systemd-inhibit n'existe pas", () => {
    const v = createLogindBackup(() => null);
    expect(() => { v.prevent(); v.release(); }).not.toThrow();
  });
});

describe("combiner", () => {
  it("n'oublie aucune des deux, dans les deux sens", () => {
    const trace: string[] = [];
    const v = (n: string) => ({ prevent: () => trace.push(`+${n}`), release: () => trace.push(`-${n}`) });
    const c = combine(v("a"), v("b"));
    c.prevent(); c.release();
    expect(trace).toEqual(["+a", "+b", "-a", "-b"]);
  });
});
