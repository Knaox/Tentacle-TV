import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Supervisor, type ServerState } from "./supervisor";
import type { ProcessJob } from "./serverProcess";

/**
 * Un FAUX serveur, lancé pour de vrai par le même Node : il parle le protocole
 * du fil A selon `FAKE_MODE`. Rien de Windows : ce test tourne partout.
 */
const FAKE_SERVER = `
const fs = require("fs");
const mode = process.env.FAKE_MODE;
const marker = process.env.FAKE_MARKER;
const send = (m) => process.send && process.send(m);
if (mode === "port") { send({ type: "tentacle:startup-failed", reason: "port_in_use" }); process.exit(1); }
if (mode === "crash") process.exit(3);
if (mode === "restart-once" && !fs.existsSync(marker)) { fs.writeFileSync(marker, "x"); process.exit(75); }
process.on("message", (m) => {
  if (m && m.type === "tentacle:shutdown" && mode !== "deaf") { console.log("bye " + m.reason); process.exit(0); }
  if (m && m.type === "tentacle:request") send({ type: "tentacle:response", id: m.id, ok: true, result: { appState: "running" } });
});
send({ type: "tentacle:progress", stage: "database" });
send({ type: "tentacle:ready", protocol: 1, bootId: "b", version: "9.9.9", port: Number(process.env.PORT), appState: "setup_admin" });
setInterval(() => {}, 1000);
`;

class FakeJob implements ProcessJob {
  pid = 0;
  terminated = 0;
  assign(pid: number): void {
    this.pid = pid;
  }
  terminate(): void {
    this.terminated++;
    process.kill(this.pid);
  }
}

function waitFor(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const limit = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      if (predicate()) resolve();
      else if (Date.now() > limit) reject(new Error("délai dépassé"));
      else setTimeout(tick, 20);
    };
    tick();
  });
}

describe("Supervisor", () => {
  let dir = "";
  let supervisor: Supervisor | null = null;

  afterEach(async () => {
    await supervisor?.stop("quit");
    supervisor = null;
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function setup(mode: string): { states: ServerState[]; output: string[]; job: FakeJob } {
    dir = mkdtempSync(join(tmpdir(), "host-sup-"));
    const entry = join(dir, "server.js");
    writeFileSync(entry, FAKE_SERVER);
    const states: ServerState[] = [];
    const output: string[] = [];
    const job = new FakeJob();
    supervisor = new Supervisor({
      spec: () => ({
        execPath: process.execPath,
        entry,
        cwd: dir,
        env: { ...(process.env as Record<string, string>), FAKE_MODE: mode, FAKE_MARKER: join(dir, "marker"), PORT: "3999" },
        port: 3999,
        hostVersion: "test",
        hostMethods: [],
      }),
      job,
      log: () => undefined,
      output: (chunk) => output.push(chunk),
      onState: (state) => states.push(state),
    });
    return { states, output, job };
  }

  it("passe en marche sur tentacle:ready, puis s'arrête proprement sur demande", async () => {
    const { states, output, job } = setup("normal");
    supervisor?.start();
    await waitFor(() => states.some((s) => s.kind === "running"));
    expect(states).toContainEqual({ kind: "starting", stage: "database" });
    expect(states.find((s) => s.kind === "running")).toEqual({ kind: "running", port: 3999, version: "9.9.9", appState: "setup_admin" });
    const reply = await supervisor?.process?.request("status", undefined, 5_000);
    expect(reply).toMatchObject({ type: "tentacle:response", ok: true });
    await supervisor?.stop("quit");
    expect(states.at(-1)).toEqual({ kind: "stopped" });
    expect(output.join("")).toContain("bye quit");
    expect(job.terminated).toBe(0);
  });

  it("relance aussitôt sur la sortie 75", async () => {
    const { states } = setup("restart-once");
    supervisor?.start();
    await waitFor(() => states.some((s) => s.kind === "running"));
    expect(existsSync(join(dir, "marker"))).toBe(true);
    expect(states[0]).toEqual({ kind: "starting" });
  });

  it("ne boucle pas sur un port pris", async () => {
    const { states } = setup("port");
    supervisor?.start();
    await waitFor(() => states.some((s) => s.kind === "blocked"));
    expect(states.at(-1)).toEqual({ kind: "blocked", cause: "port_in_use" });
  });

  it("termine l'objet Job quand le serveur ignore l'arrêt", async () => {
    const { states, job } = setup("deaf");
    supervisor?.start();
    await waitFor(() => states.some((s) => s.kind === "running"));
    const started = Date.now();
    await supervisor?.stop("quit");
    expect(job.terminated).toBe(1);
    expect(Date.now() - started).toBeGreaterThanOrEqual(9_000);
    expect(states.at(-1)).toEqual({ kind: "stopped" });
  }, 20_000);

  it("relance un plantage avec un délai", async () => {
    const { states } = setup("crash");
    supervisor?.start();
    await waitFor(() => states.filter((s) => s.kind === "starting").length >= 2);
    expect(states.some((s) => s.kind === "blocked")).toBe(false);
  });
});
