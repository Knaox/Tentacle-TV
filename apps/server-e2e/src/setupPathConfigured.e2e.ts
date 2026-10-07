import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authHeader, DisposableJellyfin, jellyfinToken } from "./jellyfin";
import { configureExisting, jellyfinState } from "./jellyfinSetupProbe";
import { hostCall } from "./lanClient";
import { expected, Journey } from "./setupJourney";
import { REPO, Stack, fetchWithin, waitFor } from "./stack";

/**
 * Le parcours « Jellyfin DÉJÀ configuré », au navigateur, sur la pile vécue
 * par Damien : une pile complète dont le Jellyfin a été configuré par un
 * premier essai, puis l'assistant rouvert (`tentacle setup reset`). Avant :
 * le choix était sauté, et l'assistant proposait de créer le compte et les
 * bibliothèques. Ici :
 *
 *  - l'étape « Jellyfin » d'abord, rien de coché ; tout geste avant le choix
 *    est refusé par le serveur ;
 *  - la connexion, puis les réglages conseillés — aucun écran de compte ni de
 *    bibliothèques, et le serveur refuse de créer l'un ou l'autre ;
 *  - le retour en arrière ne remonte que par ces écrans ;
 *  - chez Jellyfin, à la fin : ni compte, ni bibliothèque de plus.
 *
 * Conteneurs `ap-*`, supprimés à la fin. `E2E_PROOF_DIR` : où garder les captures.
 */
const USER = "Knaoxtest";
const PASSWORD = "ap-banc-mot-de-passe";
const BROWSER_HOST = "10.255.77.20";
const MEDIA = join(REPO, "apps/server-e2e/.runs/ap-jellyfins");
const PROOFS = process.env.E2E_PROOF_DIR ?? join(REPO, "apps/server-e2e/.runs/ap-proofs");
const P = { tentacle: 47320, jellyfin: 47900, discovery: 47364 };
const OFF = 'services:\n  tentacle:\n    environment:\n      REMOTE_CHECK_URL: "off"\n';

const salon = new DisposableJellyfin("ap-jf-salon", 8096, "12.1", MEDIA);
const stack = new Stack({
  stack: "full",
  project: "ap-full",
  env: { TENTACLE_PORT: String(P.tentacle), JELLYFIN_PORT: String(P.jellyfin), JELLYFIN_DISCOVERY_PORT: String(P.discovery) },
  override: OFF,
});
const stackJellyfin = `http://127.0.0.1:${P.jellyfin}`;
const before = { users: [] as string[], libraries: [] as string[] };

async function users(base: string): Promise<string[]> {
  const token = await jellyfinToken(base, USER, PASSWORD);
  const res = await fetchWithin(`${base}/Users`, { headers: authHeader(token) });
  return ((await res.json()) as Array<{ Name: string }>).map((u) => u.Name).sort();
}

beforeAll(async () => {
  mkdirSync(join(MEDIA, "films"), { recursive: true });
  mkdirSync(join(MEDIA, "series"), { recursive: true });
  mkdirSync(PROOFS, { recursive: true });
  await Promise.all([salon.start(), stack.up()]);
  await salon.completeStartup(USER, PASSWORD);
  await configureExisting(salon.url, await salon.token(USER, PASSWORD));
  await waitFor("le Jellyfin de la pile verrouillé", async () => (await stack.logs()).includes("[Setup] Jellyfin voisin verrouillé"), 180_000);

  // Un premier essai, mené jusqu'au bout : le Jellyfin de la pile prend le compte.
  const at = { host: `${BROWSER_HOST}:${P.tentacle}` };
  const session = ((await hostCall(P.tentacle, { ...at, path: "/session", method: "POST", body: { token: await stack.setupCode() } })).body as { session: string }).session;
  const call = (path: string, body: unknown) => hostCall(P.tentacle, { ...at, path, method: "POST", body, session });
  expect((await call("/jellyfin/select", { url: "" })).status).toBe(200);
  const init = await call("/jellyfin/initialize", { url: "http://jellyfin:8096", username: USER, password: PASSWORD, serverName: "Tentacle", uiCulture: "fr", metadataCountry: "FR", metadataLanguage: "fr" });
  expect(init.status, JSON.stringify(init.body)).toBe(200);
  // Une bibliothèque aussi : ce banc prouve le parcours d'un Jellyfin configuré qui EN A
  // (le cas « configuré mais vide » est celui de setupV3.e2e.ts).
  const library = await call("/jellyfin/libraries", { libraries: [{ name: "Films", type: "movies", paths: ["/media/films"] }], metadataLanguage: "fr", metadataCountry: "FR" });
  expect(library.status, JSON.stringify(library.body)).toBe(200);
  expect((await call("/complete", { username: USER, password: PASSWORD })).status).toBe(200);

  // Puis l'assistant rouvert, comme Damien : la base garde l'adresse et la clé de ce Jellyfin.
  await stack.exec("tentacle", "tentacle", "setup", "reset");
  await stack.compose("restart", "tentacle");
  await stack.waitHealthy();
  before.users = await users(stackJellyfin);
  before.libraries = (await jellyfinState(stackJellyfin, await jellyfinToken(stackJellyfin, USER, PASSWORD))).libraries.map((l) => l.name);
}, 10 * 60_000);

afterAll(async () => {
  await stack.down();
  await salon.remove();
});

describe("parcours « déjà configuré » (la pile de Damien)", () => {
  it("au navigateur : le choix d'abord, la connexion, les réglages conseillés — jamais compte ni bibliothèques", async () => {
    const journey = await Journey.open(PROOFS, "deja-configure");
    const { page } = journey;
    const refused = { status: 409, body: { error: "step_refused" } };
    try {
      await page.goto(stack.url(`/setup#code=${await stack.setupCode()}`));
      await journey.at("Bienvenue sur Tentacle");
      await journey.button("Commencer").click();
      await journey.at("Le code d'installation");
      await journey.button("Valider le code").click();

      // ── Le choix : jamais sauté, rien de coché, rien d'autre permis ─────
      await journey.at("Jellyfin");
      await page.getByText("Dans cette pile").first().waitFor({ timeout: 120_000 });
      await page.getByText("Salon").first().waitFor({ timeout: 60_000 });
      expect(await journey.checkedRadios()).toBe(0);
      expect(await journey.button("Continuer").isDisabled()).toBe(true);
      expect(await journey.canGoBack()).toBe(false);
      const createAccount = { url: "http://jellyfin:8096", username: "Intrus", password: PASSWORD, uiCulture: "fr", metadataCountry: "FR", metadataLanguage: "fr" };
      expect(await journey.direct("POST", "/jellyfin/initialize", createAccount)).toEqual(refused);
      expect(await journey.direct("POST", "/jellyfin/connect", { url: "http://jellyfin:8096", username: USER, password: PASSWORD })).toEqual(refused);
      expect(await journey.direct("POST", "/complete", { username: USER, password: PASSWORD })).toEqual(refused);
      await page.getByRole("radio", { name: /Dans cette pile/ }).check();
      await page.getByText(/Tentacle n'y crée rien/).first().waitFor();
      await journey.button("Se connecter à ce Jellyfin").click();

      // ── La connexion : un compte EXISTANT, rien de créé ─────────────────
      await journey.at("Connectez-vous à ce Jellyfin");
      expect(await page.getByTestId("setup-chosen-server").innerText()).toBe("Jellyfin “Tentacle” · déjà configuré · dans cette pile");
      expect(await page.getByLabel("Confirmez le mot de passe").count()).toBe(0);
      await page.getByLabel("Nom d'utilisateur").fill(USER);
      await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
      await journey.button("Se connecter").click();

      await journey.at("Réglages conseillés");
      // Relié : créer un compte ou une bibliothèque, parcourir ses dossiers — toujours refusé.
      expect(await journey.direct("POST", "/jellyfin/initialize", createAccount)).toEqual(refused);
      const library = { libraries: [{ name: "Intruse", type: "movies", paths: ["/media/films"] }], metadataLanguage: "fr", metadataCountry: "FR" };
      expect(await journey.direct("POST", "/jellyfin/libraries", library)).toEqual(refused);
      expect(await journey.direct("GET", "/jellyfin/browse")).toEqual(refused);

      // ── Le retour : seulement dans ce parcours, jusqu'au choix ──────────
      await journey.button("Retour").click();
      await journey.at("Connectez-vous à ce Jellyfin");
      await page.getByText(`Connecté à ce Jellyfin en tant que “${USER}”.`).waitFor();
      await journey.button("Retour").click();
      await journey.at("Jellyfin");
      expect(await journey.canGoBack()).toBe(false);
      // Le choix d'avant reste coché : c'était un geste.
      await page.getByRole("radio", { name: /Dans cette pile/ }).waitFor();
      expect(await page.getByRole("radio", { name: /Dans cette pile/ }).isChecked()).toBe(true);

      // ── Jusqu'au bout ───────────────────────────────────────────────────
      await journey.button("Se connecter à ce Jellyfin").click();
      await journey.at("Connectez-vous à ce Jellyfin");
      await journey.button("Continuer").click();
      await journey.at("Réglages conseillés");
      await journey.button("Passer — ne rien changer").click();
      await journey.at("Récapitulatif");
      await journey.button("Installer").click();
      await journey.at("Accès à distance (facultatif)");
      await journey.button("Plus tard").click();
      await journey.at("Et maintenant ?");
      const screens = await journey.save();
      await journey.button("Ouvrir Tentacle").click();
      await page.waitForURL(stack.url("/"));

      expect(screens.map(({ title, progress }) => ({ title, progress }))).toEqual(
        expected(9, [
          ["Bienvenue sur Tentacle", 1],
          ["Le code d'installation", 2],
          ["Jellyfin", 3],
          ["Connectez-vous à ce Jellyfin", 4],
          ["Réglages conseillés", 5],
          ["Connectez-vous à ce Jellyfin", 4],
          ["Jellyfin", 3],
          ["Connectez-vous à ce Jellyfin", 4],
          ["Réglages conseillés", 5],
          ["Récapitulatif", 6],
          ["Installation", 7],
          ["Accès à distance (facultatif)", 8],
          ["Et maintenant ?", 9],
        ]),
      );
      // Le Jellyfin choisi est rappelé sur chaque écran de son parcours, et sur eux seuls.
      for (const screen of screens) {
        const inPath = ["Connectez-vous à ce Jellyfin", "Réglages conseillés", "Récapitulatif", "Installation"].includes(screen.title);
        expect([screen.title, screen.server]).toEqual([screen.title, inPath ? "Jellyfin “Tentacle” · déjà configuré · dans cette pile" : ""]);
      }
    } catch (error) {
      await journey.failed();
      throw error;
    } finally {
      await journey.close();
    }
  }, 8 * 60_000);

  it("chez Jellyfin : aucun compte ni aucune bibliothèque de plus ; l'assistant est fermé", async () => {
    expect(await users(stackJellyfin)).toEqual(before.users);
    const state = await jellyfinState(stackJellyfin, await jellyfinToken(stackJellyfin, USER, PASSWORD));
    expect(state.libraries.map((l) => l.name)).toEqual(before.libraries);
    expect((await stack.sql("SELECT COUNT(*) FROM server_config WHERE `key` = 'setup_jellyfin_selection'")).trim()).toBe("0");
    expect((await hostCall(P.tentacle, { host: `${BROWSER_HOST}:${P.tentacle}`, path: "/jellyfin/select", method: "POST", body: { url: "" } })).status).toBe(404);
  });
});
