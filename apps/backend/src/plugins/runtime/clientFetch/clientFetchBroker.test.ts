import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientFetchBroker } from "./clientFetchBroker";
import { CLIENT_FETCH_LIMITS, type ClientFetchJob } from "../pluginClientFetch";

const manifest = { hosts: ["music.example.com"], mediaHosts: ["*.media.example.net"] };
const request = { method: "POST" as const, url: "https://music.example.com/api", headers: { "Content-Type": "application/json" }, body: "{}", timeoutMs: 1_000 };

function rig(online = new Set(["dev-A", "dev-B"])) {
  const sent: { key: string; job: ClientFetchJob }[] = [];
  const broker = new ClientFetchBroker({ send: (key, job) => (online.has(key) ? (sent.push({ key, job }), true) : false), online: (key) => online.has(key) });
  return { broker, sent, online };
}

const okReply = (body = "{\"a\":1}", url = "https://music.example.com/api") => ({ ok: true as const, response: { status: 200, url, headers: { "content-type": "application/json", "set-cookie": "x" }, body } });

afterEach(() => vi.useRealTimers());

describe("requêtes déléguées — le courtier", () => {
  it("pousse la requête sur la socket de L'appareil de la poignée, et rend sa réponse", async () => {
    const { broker, sent } = rig();
    const handle = broker.handleFor("sillon", "dev-A")!;
    expect(handle).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const pending = broker.run("sillon", manifest, handle, request);
    expect(sent).toHaveLength(1);
    expect(sent[0].key).toBe("dev-A");
    expect(sent[0].job).toMatchObject({ type: "plugin:clientFetch", pluginId: "sillon", request });
    expect(broker.accept(sent[0].job.id, "dev-A", okReply())).toBe(true);
    // Seul `content-type` remonte à l'extension.
    expect(await pending).toEqual({ ok: true, response: { status: 200, url: "https://music.example.com/api", headers: { "content-type": "application/json" }, body: "{\"a\":1}" } });
    expect(broker.pendingCount).toBe(0);
  });

  it("une poignée est propre à (extension, appareil) : une autre extension ne s'en sert pas", async () => {
    const { broker, sent } = rig();
    const handle = broker.handleFor("sillon", "dev-A")!;
    expect(broker.handleFor("sillon", "dev-B")).not.toBe(handle);
    expect(broker.handleFor("autre", "dev-A")).not.toBe(handle);
    expect(await broker.run("autre", manifest, handle, request)).toEqual({ ok: false, reason: "offline" });
    expect(await broker.run("sillon", manifest, "x".repeat(32), request)).toEqual({ ok: false, reason: "offline" });
    expect(sent).toHaveLength(0);
  });

  it("refuse sans rien envoyer une requête hors du manifeste (ou sans manifeste)", async () => {
    const { broker, sent } = rig();
    const handle = broker.handleFor("sillon", "dev-A")!;
    expect(await broker.run("sillon", manifest, handle, { ...request, url: "https://192.168.1.1/admin" })).toEqual({ ok: false, reason: "refused" });
    expect(await broker.run("sillon", manifest, handle, { ...request, headers: { Cookie: "a=b" } })).toEqual({ ok: false, reason: "refused" });
    expect(await broker.run("sillon", undefined, handle, request)).toEqual({ ok: false, reason: "refused" });
    expect(sent).toHaveLength(0);
  });

  it("n'accepte la réponse que de l'appareil visé, une seule fois", async () => {
    const { broker, sent } = rig();
    const pending = broker.run("sillon", manifest, broker.handleFor("sillon", "dev-A")!, request);
    const id = sent[0].job.id;
    expect(broker.accept(id, "dev-B", okReply("forgé"))).toBe(false);
    expect(broker.accept(id, "dev-A", okReply())).toBe(true);
    expect(broker.accept(id, "dev-A", okReply())).toBe(false);
    expect((await pending).ok).toBe(true);
  });

  it("une réponse trop grande ou d'un hôte final non déclaré ne passe pas", async () => {
    const { broker, sent } = rig();
    const handle = broker.handleFor("sillon", "dev-A")!;
    const big = broker.run("sillon", manifest, handle, { ...request, maxBytes: 10 });
    broker.accept(sent[0].job.id, "dev-A", okReply("x".repeat(11)));
    expect(await big).toEqual({ ok: false, reason: "tooLarge" });
    const moved = broker.run("sillon", manifest, handle, request);
    broker.accept(sent[1].job.id, "dev-A", okReply("{}", "https://evil.example.org/"));
    expect(await moved).toEqual({ ok: false, reason: "refused" });
  });

  it("un appareil muet : `timeout` passé le délai demandé (plus une marge)", async () => {
    vi.useFakeTimers();
    const { broker } = rig();
    const pending = broker.run("sillon", manifest, broker.handleFor("sillon", "dev-A")!, request);
    vi.advanceTimersByTime(2_600);
    expect(await pending).toEqual({ ok: false, reason: "timeout" });
    expect(broker.pendingCount).toBe(0);
  });

  it("un appareil parti : ses poignées tombent, ses requêtes échouent `offline`", async () => {
    const { broker, online } = rig();
    const handle = broker.handleFor("sillon", "dev-A")!;
    const pending = broker.run("sillon", manifest, handle, request);
    online.delete("dev-A");
    broker.forgetDevice("dev-A");
    expect(await pending).toEqual({ ok: false, reason: "offline" });
    expect(await broker.run("sillon", manifest, handle, request)).toEqual({ ok: false, reason: "offline" });
    expect(broker.handleFor("sillon", "dev-A")).toBeNull();
  });

  it("plafond d'appareil : au-delà des requêtes en parallèle, `budget`", async () => {
    const { broker } = rig();
    const handle = broker.handleFor("sillon", "dev-A")!;
    for (let i = 0; i < CLIENT_FETCH_LIMITS.maxParallel; i++) void broker.run("sillon", manifest, handle, request);
    expect(await broker.run("sillon", manifest, handle, request)).toEqual({ ok: false, reason: "budget" });
  });

  it("l'échec rapporté par l'appareil passe tel quel", async () => {
    const { broker, sent } = rig();
    const pending = broker.run("sillon", manifest, broker.handleFor("sillon", "dev-A")!, request);
    broker.accept(sent[0].job.id, "dev-A", { ok: false, reason: "network" });
    expect(await pending).toEqual({ ok: false, reason: "network" });
  });

  it("le budget de l'adresse de sortie : refusé → `budget` sans rien envoyer ; la nature de la requête lui est dite", async () => {
    const online = new Set(["dev-A"]);
    const sent: ClientFetchJob[] = [];
    const asked: { egress: string; kind: string }[] = [];
    let open = true;
    const broker = new ClientFetchBroker({
      send: (_key, job) => (sent.push(job), true),
      online: (key) => online.has(key),
      admit: (egress, kind) => (asked.push({ egress, kind }), open ? { granted: true, waitMs: 0 } : { granted: false }),
    });
    const handle = broker.handleFor("sillon", "dev-A", "v4:203.0.113.9")!;
    const pending = broker.run("sillon", manifest, handle, { ...request, kind: "prefetch" });
    expect(sent).toHaveLength(1);
    broker.accept(sent[0].id, "dev-A", okReply());
    await pending;
    open = false;
    expect(await broker.run("sillon", manifest, handle, request)).toEqual({ ok: false, reason: "budget" });
    expect(sent).toHaveLength(1);
    expect(asked).toEqual([{ egress: "v4:203.0.113.9", kind: "prefetch" }, { egress: "v4:203.0.113.9", kind: "play" }]);
  });
});
