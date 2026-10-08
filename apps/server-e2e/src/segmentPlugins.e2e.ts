import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DisposableJellyfin, jellyfinToken } from "./jellyfin";
import { admin, followRun, GUID, JellyfinPeek, outcomes, type Run } from "./segmentProbe";
import { SetupClient } from "./setupClient";
import { docker, sleep, Stack, waitFor } from "./stack";

/**
 * La détection des passages, sur de vrais Jellyfin : l'assistant pose Intro
 * Skipper, TheIntroDB et SkipMe.db (dépôts, installation, redémarrage par
 * l'API de Jellyfin, réglages) — sur le Jellyfin NEUF d'une pile complète
 * (12) comme sur un Jellyfin EXISTANT (10.11). Puis l'action de
 * l'administration, la migration d'un serveur d'avant (analyse coupée une
 * fois), et le choix de l'administrateur respecté ensuite.
 */
const USER = "Knaoxtest";
const PASSWORD = randomBytes(12).toString("base64url");
const OVERRIDE = "services:\n  tentacle:\n    environment:\n      REMOTE_CHECK_URL: \"off\"\n";
const DETECT_TASK = "IntroSkipperDetectSegmentsTask";

const IN_PLACE = new Set(["installed", "present", "enabled"]);

describe("pile complète, Jellyfin 12 neuf", () => {
  const ports = { tentacle: 3511, jellyfin: 9011, discovery: 7371 };
  const stack = new Stack({
    stack: "full",
    project: "pass-e2e-full",
    env: { TENTACLE_PORT: String(ports.tentacle), JELLYFIN_PORT: String(ports.jellyfin), JELLYFIN_DISCOVERY_PORT: String(ports.discovery) },
    override: OVERRIDE,
  });
  const client = new SetupClient(stack.url(""));
  const jellyfinBase = `http://127.0.0.1:${ports.jellyfin}`;
  let peek: JellyfinPeek;
  let session = "";

  beforeAll(() => stack.up());
  afterAll(() => stack.down());

  it("l'assistant installe les trois greffons, redémarre Jellyfin et coupe l'écoute d'Intro Skipper", async () => {
    const code = await stack.setupCode();
    await waitFor("le Jellyfin voisin verrouillé", async () => (await stack.logs()).includes("[Setup] Jellyfin voisin verrouillé"), 180_000, 2_000);
    expect((await client.open(code)).status).toBe(200);
    const context = (await client.call("/context")).body as { jellyfin: { url: string | null; suggestedUrl: string | null } };
    const url = context.jellyfin.url ?? context.jellyfin.suggestedUrl;
    expect((await client.call("/jellyfin/select", { method: "POST", body: { url } })).status).toBe(200);
    const init = await client.call("/jellyfin/initialize", {
      method: "POST",
      body: { url, username: USER, password: PASSWORD, uiCulture: "fr-FR", metadataCountry: "FR", metadataLanguage: "fr" },
    });
    expect(init.status).toBe(200);

    const started = Date.now();
    expect((await client.call("/jellyfin/segments", { method: "POST" })).status).toBe(202);
    const run = await followRun(async () => (await client.call("/jellyfin/segments")).body as Run);
    console.log(`[banc] pile complète : ${JSON.stringify(run)} en ${Math.round((Date.now() - started) / 1000)} s`);
    expect(outcomes(run)).toEqual({ introSkipper: "installed", theIntroDb: "installed", skipMeDb: "installed" });
    expect(run.restart).toBe("done");
    expect(run.configured).toBe(true);

    peek = new JellyfinPeek(jellyfinBase, await jellyfinToken(jellyfinBase, USER, PASSWORD));
    const plugins = await peek.plugins();
    for (const guid of Object.values(GUID)) expect(plugins[guid]?.status, guid).toBe("Active");
    console.log(`[banc] versions sur 12 : ${JSON.stringify(Object.fromEntries(Object.entries(GUID).map(([k, g]) => [k, plugins[g]?.version])))}`);
    expect((await peek.config(GUID.introSkipper)).AutoDetectIntros).toBe(false);
    expect((await peek.task(DETECT_TASK))?.Triggers).toEqual([]);
    expect((await peek.config(GUID.theIntroDb)).EnableOnDemandFetch).toBe(true);
  });

  it("fin de l'assistant ; l'analyse audio de Tentacle est coupée d'office", async () => {
    const done = await client.call("/complete", { method: "POST", body: { username: USER, password: PASSWORD } });
    expect(done.status).toBe(200);
    session = (done.body as { AccessToken: string }).AccessToken;
    expect((await admin(stack.url(""), session, "/audio-analysis")).body).toMatchObject({ enabled: false });
    const setup = (await admin(stack.url(""), session, "/jellyfin/setup")).body as { checks: Array<{ id: string; state: string }> };
    expect(setup.checks.find((check) => check.id === "segmentsProvider")?.state).toBe("done");
  });

  it("« Installer / réparer » : une écoute rallumée à la main est recoupée, sans redémarrage", async () => {
    await peek.setConfig(GUID.introSkipper, { AutoDetectIntros: true });
    expect((await admin(stack.url(""), session, "/jellyfin/segment-plugins", { method: "POST", body: {} })).status).toBe(202);
    const run = await followRun(async () => (await admin(stack.url(""), session, "/jellyfin/segment-plugins")).body as Run);
    expect(outcomes(run)).toEqual({ introSkipper: "present", theIntroDb: "present", skipMeDb: "present" });
    expect(run.restart).toBe("not-needed");
    expect((await peek.config(GUID.introSkipper)).AutoDetectIntros).toBe(false);
  });

  it("migration d'un serveur d'avant : analyse audio et écoute d'Intro Skipper coupées une fois", async () => {
    // Un serveur d'avant : aucune marque, la clé de l'analyse absente (« oui »), Intro Skipper à l'écoute.
    await stack.sql("DELETE FROM server_config WHERE `key` IN ('audio_analysis_enabled','audio_analysis_default_off_applied','introskipper_audio_off_applied')");
    await peek.setConfig(GUID.introSkipper, { AutoDetectIntros: true });
    await peek.setTriggers(DETECT_TASK, [{ Type: "DailyTrigger", TimeOfDayTicks: 0 }]);
    await stack.compose("restart", "tentacle");
    await stack.waitHealthy();
    // Le guet passe une minute après le démarrage.
    await waitFor("Intro Skipper coupée par la migration", async () => (await peek.config(GUID.introSkipper)).AutoDetectIntros === false, 180_000, 5_000);
    expect((await peek.task(DETECT_TASK))?.Triggers).toEqual([]);
    const rows = await stack.sql("SELECT `key`, `value` FROM server_config WHERE `key` IN ('audio_analysis_enabled','audio_analysis_default_off_applied','introskipper_audio_off_applied') ORDER BY `key`");
    expect(rows).toMatch(/audio_analysis_default_off_applied\t\S+/);
    expect(rows).toMatch(/audio_analysis_enabled\tfalse/);
    expect(rows).toMatch(/introskipper_audio_off_applied\t\S+/);
  });

  it("ensuite, le choix de l'administrateur est respecté au redémarrage", async () => {
    await peek.setConfig(GUID.introSkipper, { AutoDetectIntros: true });
    expect((await admin(stack.url(""), session, "/audio-analysis", { method: "PUT", body: { enabled: true } })).status).toBe(200);
    await stack.compose("restart", "tentacle");
    await stack.waitHealthy();
    await sleep(80_000);
    expect((await peek.config(GUID.introSkipper)).AutoDetectIntros).toBe(true);
    expect((await admin(stack.url(""), session, "/audio-analysis")).body).toMatchObject({ enabled: true });
  });
});

describe("Jellyfin 10.11 existant, pile seule", () => {
  const ports = { tentacle: 3521, jellyfin: 9021 };
  const stack = new Stack({ stack: "only", project: "pass-e2e-db1011", env: { TENTACLE_PORT: String(ports.tentacle) }, override: OVERRIDE });
  const jellyfin = new DisposableJellyfin("pass-e2e-jf1011", ports.jellyfin, "10.11", join(stack.dir, "jellyfin-media"));
  const client = new SetupClient(stack.url(""));

  beforeAll(async () => {
    mkdirSync(jellyfin.media, { recursive: true });
    await jellyfin.start();
    await jellyfin.completeStartup(USER, PASSWORD);
    await stack.up();
  });
  afterAll(async () => {
    await stack.down();
    await jellyfin.remove();
  });

  it("l'assistant pose les greffons de 10.11 ; un dépôt injoignable par Jellyfin n'arrête rien", async () => {
    // Jellyfin ne joint plus GitHub brut (le dépôt de TheIntroDB) : Tentacle, lui, le lit.
    await docker("exec", jellyfin.name, "sh", "-c", "echo '127.0.0.1 raw.githubusercontent.com' >> /etc/hosts");
    expect((await client.open(await stack.setupCode())).status).toBe(200);
    const url = `http://host.docker.internal:${ports.jellyfin}`;
    expect((await client.call("/jellyfin/select", { method: "POST", body: { url } })).status).toBe(200);
    expect((await client.call("/jellyfin/connect", { method: "POST", body: { url, username: USER, password: PASSWORD } })).status).toBe(200);
    await client.call("/jellyfin/segments", { method: "POST" });
    const first = await followRun(async () => (await client.call("/jellyfin/segments")).body as Run);
    console.log(`[banc] 10.11, GitHub brut coupé : ${JSON.stringify(first)}`);
    expect(outcomes(first)).toEqual({ introSkipper: "installed", theIntroDb: "repo-offline", skipMeDb: "installed" });
    expect(first.restart).toBe("done");
    expect(first.configured).toBe(true);

    // Le dépôt revient : le même geste complète sans rien défaire.
    // `/etc/hosts` est monté par Docker : on le réécrit en place (`sed -i` le remplacerait, refusé).
    await docker("exec", jellyfin.name, "sh", "-c", "grep -v raw.githubusercontent.com /etc/hosts > /tmp/hosts && cat /tmp/hosts > /etc/hosts");
    await client.call("/jellyfin/segments", { method: "POST" });
    const second = await followRun(async () => (await client.call("/jellyfin/segments")).body as Run);
    console.log(`[banc] 10.11, dépôt revenu : ${JSON.stringify(second)}`);
    expect(outcomes(second)).toEqual({ introSkipper: "present", theIntroDb: "installed", skipMeDb: "present" });
    expect(second.restart).toBe("done");

    const peek = new JellyfinPeek(jellyfin.url, await jellyfin.token(USER, PASSWORD));
    const plugins = await peek.plugins();
    for (const guid of Object.values(GUID)) expect(plugins[guid]?.status, guid).toBe("Active");
    console.log(`[banc] versions sur 10.11 : ${JSON.stringify(Object.fromEntries(Object.entries(GUID).map(([k, g]) => [k, plugins[g]?.version])))}`);
    expect((await peek.config(GUID.introSkipper)).AutoDetectIntros).toBe(false);
    expect((await peek.task(DETECT_TASK))?.Triggers).toEqual([]);
    for (const outcome of Object.values(outcomes(second))) expect(IN_PLACE.has(String(outcome))).toBe(true);
  });

  it("fin de l'assistant", async () => {
    expect((await client.call("/complete", { method: "POST", body: { username: USER, password: PASSWORD } })).status).toBe(200);
  });
});
