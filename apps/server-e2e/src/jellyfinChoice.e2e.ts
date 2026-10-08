import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchChrome } from "./browser";
import { authHeader, DisposableJellyfin, jellyfinToken } from "./jellyfin";
import { hostCall } from "./lanClient";
import { configureExisting, jellyfinState } from "./jellyfinSetupProbe";
import { REPO, Stack, waitFor } from "./stack";
import { requireHostCode } from "./benchHost";

/**
 * L'étape Jellyfin liste TOUS les Jellyfin, neufs et déjà configurés
 * distingués — en pile complète, le sien en tête et choisi d'office.
 *
 *  A. Pile complète + un Jellyfin DÉJÀ configuré (8096 : deux bibliothèques,
 *     langue en anglais) + un NEUF (8097). La liste et ses états ; au
 *     navigateur, le déjà configuré choisi : son compte existant, AUCUNE
 *     bibliothèque créée, les réglages conseillés appliqués seulement s'ils
 *     sont cochés (aperçus oui ; surveillance, passages et langue non).
 *  B. Une seconde pile complète : son Jellyfin NEUF choisi — le parcours
 *     complet (compte créé, Films et Séries, détection des passages).
 *
 * Conteneurs `ajf-*`, supprimés à la fin. `E2E_PROOF_DIR` : où garder les captures.
 */
const USER = "Knaoxtest";
const PASSWORD = "ajf-banc-mot-de-passe";
const BROWSER_HOST = "10.255.77.10";
const MEDIA = join(REPO, "apps/server-e2e/.runs/ajf-jellyfins");
const PROOFS = process.env.E2E_PROOF_DIR ?? join(REPO, "apps/server-e2e/.runs/ajf-proofs");
const A = { tentacle: 47310, jellyfin: 47898, discovery: 47361 };
const B = { tentacle: 47311, jellyfin: 47899, discovery: 47362 };
const OFF = 'services:\n  tentacle:\n    environment:\n      REMOTE_CHECK_URL: "off"\n';

const configured = new DisposableJellyfin("ajf-jf-configured", 8096, "12.1", MEDIA);
const blank = new DisposableJellyfin("ajf-jf-new", 8097, "12.1", MEDIA);
const fullEnv = (p: typeof A) => ({ TENTACLE_PORT: String(p.tentacle), JELLYFIN_PORT: String(p.jellyfin), JELLYFIN_DISCOVERY_PORT: String(p.discovery) });
const stackA = new Stack({ stack: "full", project: "ajf-full", env: fullEnv(A), override: OFF });
const stackB = new Stack({ stack: "full", project: "ajf-full-new", env: fullEnv(B), override: OFF });

interface Found {
  url: string;
  serverName: string;
  blank: boolean;
  inStack: boolean;
  serverId: string;
  clientUrl: string | null;
}

beforeAll(async () => {
  mkdirSync(join(MEDIA, "films"), { recursive: true });
  mkdirSync(join(MEDIA, "series"), { recursive: true });
  mkdirSync(PROOFS, { recursive: true });
  await Promise.all([configured.start(), blank.start(), stackA.up(), stackB.up()]);
  await configured.completeStartup(USER, PASSWORD);
  await configureExisting(configured.url, await configured.token(USER, PASSWORD));
}, 10 * 60_000);

afterAll(async () => {
  await Promise.all([stackA.down(), stackB.down()]);
  await Promise.all([configured.remove(), blank.remove()]);
});

describe("A. pile complète : la liste, puis un Jellyfin DÉJÀ configuré", () => {
  let servers: Found[] = [];
  const before = { libraries: [] as string[] };

  it("la liste : celui de la pile en tête (neuf, verrouillé), puis le neuf, puis le déjà configuré", async () => {
    await waitFor("le Jellyfin de la pile verrouillé", async () => (await stackA.logs()).includes("[Setup] Jellyfin voisin verrouillé"), 180_000);
    const session = ((await hostCall(A.tentacle, { host: `${BROWSER_HOST}:${A.tentacle}`, path: "/session", method: "POST", body: { token: await stackA.setupCode() } })).body as { session: string }).session;
    const reply = await hostCall(A.tentacle, { host: `${BROWSER_HOST}:${A.tentacle}`, path: "/jellyfin/discover", session });
    expect(reply.status, JSON.stringify(reply.body)).toBe(200);
    servers = (reply.body as { servers: Found[] }).servers;
    console.info(JSON.stringify(servers.map(({ url, serverName, blank, inStack, clientUrl }) => ({ url, serverName, blank, inStack, clientUrl }))));
    expect(servers[0]).toMatchObject({ url: "http://jellyfin:8096", inStack: true, blank: true, clientUrl: `http://${BROWSER_HOST}:${A.jellyfin}` });
    const others = servers.slice(1);
    expect(others.map((s) => new URL(s.url).port)).toEqual(["8097", "8096"]);
    expect(others.map((s) => [s.blank, s.inStack])).toEqual([[true, false], [false, false]]);
    expect(new Set(servers.map((s) => s.serverId)).size).toBe(servers.length);
    before.libraries = (await jellyfinState(configured.url, await configured.token(USER, PASSWORD))).libraries.map((l) => l.name);
    expect(before.libraries.sort()).toEqual(["Films", "Séries"]);
  });

  it("au navigateur : le déjà configuré choisi, son compte, les réglages conseillés (seulement les cochés), aucune bibliothèque", async () => {
    // La session d'API ci-dessus a pris le code : un nouveau, pour le navigateur.
    const banner = await stackA.exec("tentacle", "tentacle", "setup", "token");
    const code = /([0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4})/.exec(banner)?.[1] ?? "";
    expect(code, banner).not.toBe("");
    const browser = await launchChrome();
    const page = await (await browser.newContext({ locale: "fr-FR", viewport: { width: 1100, height: 1300 } })).newPage();
    const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
    try {
      await requireHostCode(stackA.port, `127.0.0.1:${stackA.port}`);
      await page.goto(stackA.url(`/setup#code=${code}`));
      await button("Commencer").click();
      await button("Valider le code").click();
      await page.getByText("Dans cette pile").waitFor({ timeout: 60_000 });
      await page.getByText("Déjà configurés — vous vous connectez avec un compte administrateur existant").waitFor({ timeout: 60_000 });
      await page.getByText("Neufs — Tentacle les configure pour vous").waitFor();
      // Rien n'est coché d'office : celui de la pile est seulement conseillé.
      expect(await page.locator('input[type="radio"]:checked').count()).toBe(0);
      await page.screenshot({ path: join(PROOFS, "1-liste-jellyfin.png"), fullPage: true });
      await page.getByRole("radio", { name: /Salon/ }).check();
      await page.getByText(/Tentacle n'y crée rien/).waitFor();
      await button("Se connecter à ce Jellyfin").click();

      await page.getByLabel("Nom d'utilisateur").fill(USER);
      await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
      // Un Jellyfin rejoint garde sa langue : pas de champ ici.
      expect(await page.getByRole("combobox", { name: "Langue", exact: true }).count()).toBe(0);
      await button("Se connecter").click();

      await page.getByRole("heading", { name: "Réglages conseillés" }).waitFor({ timeout: 60_000 });
      await page.getByText(/Bibliothèques de ce Jellyfin.*Films · Séries/).waitFor();
      const box = (name: RegExp) => page.getByRole("checkbox", { name });
      await box(/Aperçus de la barre de lecture/).waitFor();
      expect(await box(/Aperçus de la barre de lecture/).isChecked()).toBe(true);
      expect(await box(/Surveillance en temps réel/).isChecked()).toBe(true);
      expect(await box(/Détection des passages/).isChecked()).toBe(true);
      // Réglée autrement (anglais) : montrée, jamais cochée d'office.
      expect(await box(/Langue des métadonnées/).isChecked()).toBe(false);
      await page.getByText(/Actuellement.*English · États-Unis.*conseillé.*Français · France/).waitFor();
      await page.screenshot({ path: join(PROOFS, "2-reglages-conseilles.png"), fullPage: true });
      await box(/Surveillance en temps réel/).uncheck();
      await box(/Détection des passages/).uncheck();
      await button("Continuer").click();

      await page.getByText(/Aucune création — déjà dans Jellyfin.*Films · Séries/).waitFor();
      await page.screenshot({ path: join(PROOFS, "3-recapitulatif.png"), fullPage: true });
      await button("Installer").click();
      await page.getByRole("heading", { name: "Accès à distance (facultatif)" }).waitFor({ timeout: 120_000 });
      await button("Plus tard").click();
      await page.getByRole("heading", { name: "Et maintenant ?" }).waitFor();
      await button("Ouvrir Tentacle").click();
      await page.waitForURL(stackA.url("/"));
    } catch (error) {
      await page.screenshot({ path: join(PROOFS, "echec-A.png"), fullPage: true }).catch(() => undefined);
      writeFileSync(join(PROOFS, "echec-A.txt"), `${page.url()}\n\n${await page.innerText("body").catch(() => "")}`);
      throw error;
    } finally {
      await browser.close();
    }
  }, 6 * 60_000);

  it("chez Jellyfin : les mêmes bibliothèques, SEULS les aperçus activés, la langue et les greffons intacts", async () => {
    const state = await jellyfinState(configured.url, await configured.token(USER, PASSWORD));
    console.info(JSON.stringify(state));
    expect(state.libraries.map((l) => l.name).sort()).toEqual(before.libraries.sort());
    expect(state.libraries.every((l) => l.trickplay)).toBe(true);
    expect(state.libraries.every((l) => !l.realtime)).toBe(true);
    expect(state.language).toBe("en · US");
    expect(state.plugins.filter((name) => /intro skipper|theintrodb|skipme/i.test(name))).toEqual([]);
    expect((await stackA.sql("SELECT value FROM server_config WHERE `key` = 'jellyfin_url'")).trim()).toMatch(/:8096$/);
    expect((await stackA.sql("SELECT value FROM server_config WHERE `key` = 'jellyfin_private_url'")).trim()).toBe("http://127.0.0.1:8096");
  });

  it("le Jellyfin de la pile, pas choisi, reste verrouillé (jamais rouvert au réseau) et n'a rien reçu", async () => {
    const info = (await (await fetch(`http://127.0.0.1:${A.jellyfin}/System/Info/Public`)).json()) as { StartupWizardCompleted: boolean };
    expect(info.StartupWizardCompleted).toBe(true);
    expect(await stackA.logs()).toContain("le Jellyfin de la pile reste verrouillé");
  });
});

describe("B. pile complète : son Jellyfin NEUF — le parcours complet", () => {
  it("compte créé, Films et Séries créées, détection des passages posée, installation fermée", async () => {
    await waitFor("le Jellyfin de la pile verrouillé", async () => (await stackB.logs()).includes("[Setup] Jellyfin voisin verrouillé"), 180_000);
    const at = { host: `${BROWSER_HOST}:${B.tentacle}` };
    const session = ((await hostCall(B.tentacle, { ...at, path: "/session", method: "POST", body: { token: await stackB.setupCode() } })).body as { session: string }).session;
    const call = (path: string, method: "GET" | "POST" = "GET", body?: unknown) => hostCall(B.tentacle, { ...at, path, method, body, session });
    const stack = ((await call("/jellyfin/discover")).body as { servers: Found[] }).servers[0];
    expect(stack).toMatchObject({ inStack: true, blank: true });
    expect((await call("/jellyfin/select", "POST", { url: stack.url })).status).toBe(200);
    expect((await call("/jellyfin/initialize", "POST", { url: stack.url, username: USER, password: PASSWORD, serverName: "Tentacle", uiCulture: "fr", metadataCountry: "FR", metadataLanguage: "fr" })).status).toBe(200);
    expect((await call("/context")).body).toMatchObject({ jellyfin: { configured: true, claimed: false, joined: false } });
    expect((await call("/jellyfin/segments", "POST")).status).toBe(202);
    const run = await waitFor("la détection des passages", async () => {
      const status = (await call("/jellyfin/segments")).body as { running: boolean; finishedAt: string | null; plugins?: Array<{ outcome: string }> };
      return !status.running && status.finishedAt ? status : null;
    }, 300_000, 3_000);
    console.info(JSON.stringify(run));
    const libraries = await call("/jellyfin/libraries", "POST", {
      libraries: [{ name: "Films", type: "movies", paths: ["/media/films"] }, { name: "Séries", type: "tvshows", paths: ["/media/series"] }],
      metadataLanguage: "fr",
      metadataCountry: "FR",
    });
    expect(libraries.body).toEqual([{ name: "Films", status: "created" }, { name: "Séries", status: "created" }]);
    expect((await call("/complete", "POST", { username: USER, password: PASSWORD })).status).toBe(200);
    const base = `http://127.0.0.1:${B.jellyfin}`;
    const token = await jellyfinToken(base, USER, PASSWORD);
    const state = await jellyfinState(base, token);
    expect(state.libraries.map((l) => l.name).sort()).toEqual(["Films", "Séries"]);
    expect(state.plugins.filter((name) => /intro skipper|theintrodb|skipme/i.test(name)).length).toBe(3);
    expect((await fetch(`${base}/System/Info`, { headers: authHeader(token) })).ok).toBe(true);
  }, 8 * 60_000);
});
