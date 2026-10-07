import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DisposableJellyfin } from "./jellyfin";
import { configureExisting, jellyfinState } from "./jellyfinSetupProbe";
import { expected, Journey } from "./setupJourney";
import { REPO, Stack } from "./stack";

/**
 * Le parcours « Jellyfin NEUF », au navigateur, SANS Jellyfin dans la pile
 * (pile « base »), à côté d'un Jellyfin déjà configuré (« Salon ») :
 *
 *  - rien de coché d'office ; « Salon » choisi d'abord : la connexion et ses
 *    réglages conseillés ;
 *  - retour au choix, le NEUF choisi : le parcours est recalculé — le compte
 *    CRÉÉ, puis une vraie bibliothèque Jellyfin ; « Salon » est oublié (sa
 *    clé « Tentacle » révoquée), rien n'y a changé ;
 *  - le retour en arrière ne remonte que par les écrans du parcours neuf ; le
 *    compte créé n'est jamais recréé ; le serveur refuse ce qui appartient à
 *    l'autre parcours.
 *
 * Conteneurs `ap-*`, supprimés à la fin. `E2E_PROOF_DIR` : où garder les captures.
 */
const USER = "Knaoxtest";
const PASSWORD = "ap-banc-mot-de-passe";
const MEDIA = join(REPO, "apps/server-e2e/.runs/ap-jellyfins");
const PROOFS = process.env.E2E_PROOF_DIR ?? join(REPO, "apps/server-e2e/.runs/ap-proofs");
const OFF = 'services:\n  tentacle:\n    environment:\n      REMOTE_CHECK_URL: "off"\n';

const salon = new DisposableJellyfin("ap-jf-salon", 8096, "12.1", MEDIA);
const fresh = new DisposableJellyfin("ap-jf-neuf", 8097, "12.1", MEDIA);
const stack = new Stack({ stack: "db", project: "ap-db", env: { TENTACLE_PORT: "47321" }, override: OFF });
const before = { salonLibraries: [] as string[] };

beforeAll(async () => {
  mkdirSync(join(MEDIA, "films"), { recursive: true });
  mkdirSync(join(MEDIA, "series"), { recursive: true });
  mkdirSync(PROOFS, { recursive: true });
  await Promise.all([salon.start(), fresh.start(), stack.up()]);
  await salon.completeStartup(USER, PASSWORD);
  await configureExisting(salon.url, await salon.token(USER, PASSWORD));
  before.salonLibraries = (await jellyfinState(salon.url, await salon.token(USER, PASSWORD))).libraries.map((l) => l.name).sort();
}, 10 * 60_000);

afterAll(async () => {
  await stack.down();
  await Promise.all([salon.remove(), fresh.remove()]);
});

describe("parcours « neuf », sans Jellyfin dans la pile, après avoir changé d'avis", () => {
  it("au navigateur : Salon puis le neuf — le compte créé, une vraie bibliothèque, le retour borné au parcours", async () => {
    const journey = await Journey.open(PROOFS, "neuf");
    const { page } = journey;
    const refused = { status: 409, body: { error: "step_refused" } };
    const radio = (name: RegExp) => page.getByRole("radio", { name });
    try {
      await page.goto(stack.url(`/setup#code=${await stack.setupCode()}`));
      await journey.at("Bienvenue sur Tentacle");
      await journey.button("Commencer").click();
      await journey.at("Le code d'installation");
      await journey.button("Valider le code").click();

      // ── Le choix : les deux Jellyfin, rien de coché ─────────────────────
      await journey.at("Jellyfin");
      await radio(/port 8097/).waitFor({ timeout: 120_000 });
      await radio(/Salon/).waitFor({ timeout: 60_000 });
      expect(await journey.checkedRadios()).toBe(0);
      await radio(/Salon/).check();
      await journey.button("Se connecter à ce Jellyfin").click();
      await journey.at("Connectez-vous à ce Jellyfin");
      expect(await page.getByTestId("setup-chosen-server").innerText()).toBe("Jellyfin “Salon” · déjà configuré");
      await page.getByLabel("Nom d'utilisateur").fill(USER);
      await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
      await journey.button("Se connecter").click();
      await journey.at("Réglages conseillés");

      // ── Changer d'avis : retour au choix, le NEUF ───────────────────────
      await journey.button("Retour").click();
      await journey.at("Connectez-vous à ce Jellyfin");
      await journey.button("Retour").click();
      await journey.at("Jellyfin");
      await radio(/port 8097/).check();
      await page.getByText("Vous aviez choisi “Salon”.", { exact: false }).waitFor();
      await journey.button("Configurer ce Jellyfin").click();

      await journey.at("Votre compte administrateur");
      expect(await page.getByTestId("setup-chosen-server").innerText()).toMatch(/^Jellyfin “.+” · neuf$/);
      // Neuf : se connecter à un compte existant ou ses réglages conseillés, non.
      expect(await journey.direct("POST", "/jellyfin/connect", { url: "http://ignore:8097", username: USER, password: PASSWORD })).toEqual(refused);
      expect(await journey.direct("GET", "/jellyfin/recommended")).toEqual(refused);
      await page.getByLabel("Nom d'utilisateur").fill(USER);
      await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
      await page.getByLabel("Confirmez le mot de passe").fill(PASSWORD);
      await journey.button("Préparer Jellyfin").click();

      // ── Une VRAIE bibliothèque Jellyfin ─────────────────────────────────
      await journey.at("Vos bibliothèques");
      expect(await journey.direct("POST", "/jellyfin/initialize", { url: "http://ignore:8097", username: "Autre", password: PASSWORD, uiCulture: "fr", metadataCountry: "FR", metadataLanguage: "fr" })).toEqual(refused);
      // Hors de la pile : Films et Séries proposées SANS dossier — à choisir soi-même.
      expect(await journey.button("Continuer").isDisabled()).toBe(true);
      await journey.button("Choisir le dossier").first().click();
      for (const folder of ["/", "media", "films"]) {
        const entry = journey.button(folder);
        await entry.first().waitFor({ timeout: folder === "/" ? 5_000 : 30_000 }).then(() => entry.first().click(), () => undefined);
      }
      await journey.button("Choisir ce dossier").click();
      await page.getByText("/media/films").first().waitFor();
      await page.getByRole("button", { name: "Retirer Séries" }).click();
      await journey.button("Continuer").click();
      await journey.at("Récapitulatif");
      await page.getByText("Films (/media/films)").waitFor();

      // ── Le retour : seulement les écrans du parcours neuf ───────────────
      await journey.button("Retour").click();
      await journey.at("Vos bibliothèques");
      await journey.button("Retour").click();
      await journey.at("Votre compte administrateur");
      await page.getByText(`Le compte administrateur “${USER}” est créé sur ce Jellyfin.`).waitFor();
      expect(await page.getByLabel("Confirmez le mot de passe").count()).toBe(0);
      await journey.button("Retour").click();
      await journey.at("Jellyfin");
      expect(await journey.canGoBack()).toBe(false);
      await radio(/port 8097/).waitFor();
      expect(await radio(/port 8097/).isChecked()).toBe(true);

      // ── Jusqu'au bout ───────────────────────────────────────────────────
      await journey.button("Configurer ce Jellyfin").click();
      await journey.at("Votre compte administrateur");
      await journey.button("Continuer").click();
      await journey.at("Vos bibliothèques");
      await journey.button("Continuer").click();
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
          ["Votre compte administrateur", 4],
          ["Vos bibliothèques", 5],
          ["Récapitulatif", 6],
          ["Vos bibliothèques", 5],
          ["Votre compte administrateur", 4],
          ["Jellyfin", 3],
          ["Votre compte administrateur", 4],
          ["Vos bibliothèques", 5],
          ["Récapitulatif", 6],
          ["Installation", 7],
          ["Accès à distance (facultatif)", 8],
          ["Et maintenant ?", 9],
        ]),
      );
    } catch (error) {
      await journey.failed();
      throw error;
    } finally {
      await journey.close();
    }
  }, 12 * 60_000);

  it("chez Jellyfin : le neuf a son administrateur et SA bibliothèque ; Salon n'a rien gagné, sa clé est révoquée", async () => {
    const created = await jellyfinState(fresh.url, await fresh.token(USER, PASSWORD));
    expect(created.libraries.map((l) => l.name)).toEqual(["Films"]);
    const salonToken = await salon.token(USER, PASSWORD);
    expect((await jellyfinState(salon.url, salonToken)).libraries.map((l) => l.name).sort()).toEqual(before.salonLibraries);
    expect((await salon.keys(salonToken)).filter((key) => key.AppName === "Tentacle")).toEqual([]);
    expect((await stack.sql("SELECT value FROM server_config WHERE `key` = 'jellyfin_url'")).trim()).toMatch(/:8097$/);
  });
});
