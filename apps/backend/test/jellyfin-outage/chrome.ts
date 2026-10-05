/**
 * Chrome sans tête, piloté par le protocole DevTools — juste ce que le banc
 * web demande : une page, un cookie, un script posé à chaque chargement, une
 * expression évaluée. Chrome (pas Chromium) : il lit le H.264 et l'AAC.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export class Chrome {
  private child: ChildProcess | null = null;
  private ws: WebSocket | null = null;
  private seq = 0;
  private readonly pending = new Map<number, { ok: (v: unknown) => void; ko: (e: Error) => void }>();
  readonly console: Array<{ at: number; text: string }> = [];
  private profile = "";

  async start(port: number): Promise<void> {
    this.profile = mkdtempSync(join(tmpdir(), "tentacle-panne-chrome-"));
    this.child = spawn(CHROME, [
      "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${this.profile}`,
      "--autoplay-policy=no-user-gesture-required", "--mute-audio", "--no-first-run", "--no-default-browser-check",
      "--window-size=1280,800", "--lang=fr-FR", "about:blank",
    ], { stdio: "ignore" });
    let target: { webSocketDebuggerUrl?: string; type?: string } | undefined;
    for (let i = 0; i < 100 && !target; i++) {
      try {
        const list = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as Array<{ webSocketDebuggerUrl?: string; type?: string }>;
        target = list.find((t) => t.type === "page");
      } catch { /* pas encore prêt */ }
      if (!target) await new Promise((ok) => setTimeout(ok, 100));
    }
    if (!target?.webSocketDebuggerUrl) throw new Error("Chrome ne répond pas en CDP");
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    this.ws = ws;
    await new Promise<void>((ok, ko) => { ws.once("open", () => ok()); ws.once("error", ko); });
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw)) as {
        id?: number; result?: unknown; error?: { message: string }; method?: string;
        params?: { args?: Array<{ value?: unknown; description?: string }>; exceptionDetails?: { text?: string; exception?: { description?: string } } };
      };
      if (msg.id !== undefined) {
        const waiter = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) waiter?.ko(new Error(msg.error.message));
        else waiter?.ok(msg.result);
      } else if (msg.method === "Runtime.consoleAPICalled") {
        this.console.push({ at: Date.now(), text: (msg.params?.args ?? []).map((a) => String(a.value ?? a.description ?? "")).join(" ") });
      } else if (msg.method === "Runtime.exceptionThrown") {
        const ex = msg.params?.exceptionDetails;
        this.console.push({ at: Date.now(), text: `EXCEPTION ${ex?.exception?.description ?? ex?.text ?? ""}` });
      }
    });
    await this.send("Page.enable");
    await this.send("Runtime.enable");
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = ++this.seq;
    this.ws?.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, ko) => this.pending.set(id, { ok, ko }));
  }

  /** Une expression (enveloppée dans une fonction : `Runtime.evaluate` est un REPL). */
  async evaluate<T>(expression: string): Promise<T> {
    const res = (await this.send("Runtime.evaluate", { expression: `(() => { ${expression} })()`, returnByValue: true, awaitPromise: true })) as {
      result?: { value?: T }; exceptionDetails?: { text?: string; exception?: { description?: string } };
    };
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text ?? "exception");
    return res.result?.value as T;
  }

  async navigate(url: string): Promise<void> {
    await this.send("Page.navigate", { url });
    await new Promise((ok) => setTimeout(ok, 500));
  }

  async stop(): Promise<void> {
    this.ws?.close();
    this.child?.kill("SIGKILL");
    await new Promise((ok) => setTimeout(ok, 300));
    rmSync(this.profile, { recursive: true, force: true });
  }
}
