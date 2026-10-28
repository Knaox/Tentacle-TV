import { describe, expect, it } from "vitest";
import type { ClientFetchManifest } from "@tentacle-tv/shared/pluginClientFetch";
import { ClientFetchQuota } from "./clientFetchQuota";
import { runMobileClientFetch, type MobileFetcher } from "./mobileClientFetch";
import { MobileManifests } from "./mobileManifests";

/** Le téléphone exécute une requête déléguée : jugée, sans cookie, adresse finale revalidée, bornée. */

const manifest: ClientFetchManifest = { hosts: ["music.youtube.com", "www.youtube.com"], mediaHosts: ["*.googlevideo.com"] };
const post = { method: "POST" as const, url: "https://music.youtube.com/youtubei/v1/search", headers: { "content-type": "application/json" }, body: "{}" };

function reply(body: string, url = post.url, status = 200): Response {
  return { status, url, text: async () => body, headers: new Headers({ "content-type": "application/json" }) } as unknown as Response;
}

describe("runMobileClientFetch", () => {
  it("envoie sans cookie ni en-tête de Tentacle et rend la réponse", async () => {
    let seen: RequestInit | undefined;
    const fetcher: MobileFetcher = async (_url, init) => ((seen = init), reply('{"ok":1}'));
    const outcome = await runMobileClientFetch(post, manifest, fetcher);
    expect(outcome).toEqual({ ok: true, response: { status: 200, url: post.url, headers: { "content-type": "application/json" }, body: '{"ok":1}' } });
    expect(seen?.credentials).toBe("omit");
    expect(seen?.headers).toEqual({ "content-type": "application/json" });
  });

  it("refuse un hôte non déclaré sans rien envoyer", async () => {
    let called = false;
    const outcome = await runMobileClientFetch({ ...post, url: "https://evil.example.com/x" }, manifest, async () => ((called = true), reply("")));
    expect(outcome).toEqual({ ok: false, reason: "refused" });
    expect(called).toBe(false);
  });

  it("refuse un en-tête d'authentification", async () => {
    const outcome = await runMobileClientFetch({ ...post, headers: { Cookie: "x" } }, manifest, async () => reply(""));
    expect(outcome).toEqual({ ok: false, reason: "refused" });
  });

  it("une redirection hors des hôtes déclarés ne rend rien", async () => {
    const outcome = await runMobileClientFetch(post, manifest, async () => reply("secret", "https://other.example.org/"));
    expect(outcome).toEqual({ ok: false, reason: "refused" });
  });

  it("un corps trop grand est refusé", async () => {
    const outcome = await runMobileClientFetch({ ...post, maxBytes: 10 }, manifest, async () => reply("x".repeat(11)));
    expect(outcome).toEqual({ ok: false, reason: "tooLarge" });
    const accents = await runMobileClientFetch({ ...post, maxBytes: 10 }, manifest, async () => reply("é".repeat(6)));
    expect(accents).toEqual({ ok: false, reason: "tooLarge" });
  });

  it("délai dépassé → timeout ; panne réseau → network", async () => {
    const hang: MobileFetcher = (_u, init) => new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("abort"))));
    expect(await runMobileClientFetch({ ...post, timeoutMs: 20 }, manifest, hang)).toEqual({ ok: false, reason: "timeout" });
    expect(await runMobileClientFetch(post, manifest, async () => Promise.reject(new Error("offline")))).toEqual({ ok: false, reason: "network" });
  });
});

describe("ClientFetchQuota (téléphone)", () => {
  it("4 en parallèle au plus, 30 par minute", () => {
    let t = 0;
    const quota = new ClientFetchQuota(() => t);
    const held = [1, 2, 3, 4].map(() => quota.take("sillon"));
    expect(held.every(Boolean)).toBe(true);
    expect(quota.take("sillon")).toBeNull();
    held.forEach((release) => release?.());
    for (let i = 4; i < 30; i++) quota.take("sillon")?.();
    expect(quota.take("sillon")).toBeNull();
    t += 61_000;
    expect(quota.take("sillon")).not.toBeNull();
  });
});

describe("MobileManifests", () => {
  const list = [{ pluginId: "sillon", clientFetch: { hosts: ["music.youtube.com"], mediaHosts: ["*.googlevideo.com"] } }, { pluginId: "other" }];

  it("lit la liste une fois, puis la relit EN FOND après 5 min (le clic n'attend pas)", async () => {
    let t = 0;
    let loads = 0;
    let release: () => void = () => undefined;
    const manifests = new MobileManifests(() => {
      loads++;
      return loads === 1 ? Promise.resolve(list) : new Promise((resolve) => (release = () => resolve([])));
    }, () => t);
    expect((await manifests.of("sillon"))?.mediaHosts).toEqual(["*.googlevideo.com"]);
    expect(await manifests.of("other")).toBeNull();
    t += 6 * 60_000;
    // La relecture est en cours : l'ancienne liste répond aussitôt.
    expect((await manifests.of("sillon"))?.hosts).toEqual(["music.youtube.com"]);
    expect(loads).toBe(2);
    release();
  });

  it("une lecture ratée ne donne aucun manifeste", async () => {
    const manifests = new MobileManifests(() => Promise.reject(new Error("401")));
    expect(await manifests.of("sillon")).toBeNull();
  });
});
