import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { acquireInstance, parseCommand, type InstanceCommand } from "./singleInstance";

describe("parseCommand", () => {
  it("ne connaît que open-admin", () => {
    expect(parseCommand('{"command":"open-admin"}')).toBe("open-admin");
    expect(parseCommand('{"command":"quit"}')).toBeNull();
    expect(parseCommand("pas du json")).toBeNull();
  });
});

// Un tube nommé de Windows ; sous Linux, un socket Unix fait la même chose.
const pipeName = (): string =>
  process.platform === "win32" ? `\\\\.\\pipe\\TentacleServer.test-${randomUUID()}` : `/tmp/tentacle-host-${randomUUID()}.sock`;

describe("acquireInstance", () => {
  it("garde la première instance, et lui fait ouvrir l'administration au second lancement", async () => {
    const pipe = pipeName();
    const received: InstanceCommand[] = [];
    const first = await acquireInstance((command) => received.push(command), pipe);
    expect(first.primary).toBe(true);
    const second = await acquireInstance(() => undefined, pipe);
    expect(second.primary).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(received).toEqual(["open-admin"]);
    if (first.primary) await new Promise((resolve) => first.server.close(resolve));
    const third = await acquireInstance(() => undefined, pipe);
    expect(third.primary).toBe(true);
    if (third.primary) await new Promise((resolve) => third.server.close(resolve));
  });
});
