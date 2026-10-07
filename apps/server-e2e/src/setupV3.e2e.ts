import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { jellyfinToken } from "./jellyfin";
import { jellyfinState } from "./jellyfinSetupProbe";
import { Journey } from "./setupJourney";
import { fetchWithin } from "./stack";
import { fresh, install, lanIp, MEDIA, openToChoice, P, PASSWORD, prepare, PROOFS, reopen, salon, shootHelp, signIn, stack, stackJellyfin, teardown, USER } from "./v3Bench";

/**
 * L'assistant v3, au navigateur, sur une pile « comme sous Portainer » ouverte
 * par l'IP locale du Mac (`v3Bench.ts`) — trois Jellyfin, trois parcours :
 *
 *  A. celui de la pile, configuré par un premier essai mais SANS bibliothèque
 *     (le cas de Damien) : l'écran des bibliothèques, facultatif, avec le
 *     `/media` de Jellyfin et son dossier sur le serveur ; elles sont créées.
 *     L'accès à distance : privé par défaut, puis public (adresse détectée,
 *     les deux ports), puis de nouveau privé ; le tuto de la fin ;
 *  B. « Salon », configuré AVEC des bibliothèques : lues, jamais créées ;
 *  C. un neuf : compte créé, Films et Séries dont on choisit les dossiers.
 *
 * Puis l'administration (accès à distance, lecture directe) et l'interface web
 * coupée par `tentacle web off`. Captures dans `E2E_PROOF_DIR`.
 */
const ip = lanIp();
const refused = { status: 409, body: { error: "step_refused" } };
const titles = (screens: Array<{ title: string }>) => screens.map((s) => s.title);

beforeAll(prepare, 12 * 60_000);
afterAll(teardown);

/**
 * L'adresse publique montrée par l'écran : TOUJOURS une adresse de
 * documentation (RFC 5737), jamais la vraie de la machine du banc — les
 * captures servent à la doc et peuvent être publiées.
 */
const DOC_IP = "203.0.113.5";

async function run(prefix: string, body: (journey: Journey) => Promise<void>): Promise<void> {
  const journey = await Journey.open(PROOFS, prefix);
  await journey.page.route("**/api/admin/remote-access/public-ip", (route) =>
    route.fulfill({ json: { outcome: "found", v4: DOC_IP, v6: null, source: "echo", detectedAt: new Date().toISOString(), checkService: "offline" } }),
  );
  try {
    await body(journey);
  } catch (error) {
    await journey.failed();
    throw error;
  } finally {
    await journey.close();
  }
}

describe("A — le Jellyfin de la pile, configuré mais VIDE (le cas de Damien)", () => {
  it("ses bibliothèques sont proposées, facultatives, puis créées ; l'accès à distance privé, public, privé ; le tuto", async () => {
    await run("a-vide", async (journey) => {
      const { page } = journey;
      await openToChoice(journey, ip);
      await page.getByRole("radio", { name: /Dans cette pile/ }).check();
      await journey.button("Se connecter à ce Jellyfin").click();
      await signIn(journey);

      await journey.at("Ce Jellyfin n'a encore aucune bibliothèque");
      await page.getByText(new RegExp(`sur votre serveur, le dossier ${MEDIA.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\.`)).waitFor();
      for (const path of ["/media/films", "/media/series"]) await page.getByText(path, { exact: true }).waitFor();
      await journey.button("Passer — ne rien créer").waitFor();
      await shootHelp(journey, "bibliotheques");
      await journey.button("Choisir un dossier").first().click();
      await page.getByRole("group", { name: "Choisir un dossier" }).getByText("/media/films", { exact: true }).waitFor();
      await page.screenshot({ path: join(PROOFS, "a-vide-dossiers.png"), fullPage: true });
      await journey.button("Annuler").click();
      await journey.button("Continuer").click();

      await journey.at("Réglages conseillés");
      await journey.button("Passer — ne rien changer").click();
      await page.getByText(/À créer dans Jellyfin.*Films \(\/media\/films\).*Séries \(\/media\/series\)/).waitFor({ timeout: 30_000 });
      await install(journey);

      // ── Privé, par défaut ──────────────────────────────────────────────
      const exposure = page.getByRole("switch", { name: "Accès depuis l'extérieur" });
      expect(await exposure.getAttribute("aria-checked")).toBe("false");
      expect(await page.getByRole("textbox", { name: "Adresse de ce serveur sur votre réseau" }).inputValue()).toBe(`http://${ip}:${P.tentacle}`);
      expect(await page.locator('svg[role="img"]').count()).toBe(2);
      expect(await page.getByText("Votre adresse publique", { exact: true }).count()).toBe(0);

      // ── Public ─────────────────────────────────────────────────────────
      await exposure.click();
      await page.getByText("Votre adresse publique", { exact: true }).waitFor();
      await page.getByTestId("public-ip").or(page.getByText(/Impossible de la détecter/)).first().waitFor({ timeout: 60_000 });
      for (const port of [String(P.tentacle), String(P.jellyfin)]) await page.getByRole("cell", { name: port, exact: true }).first().waitFor();
      await page.getByText(/ni inclus ni installés|NI inclus NI installés/).waitFor();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(PROOFS, "a-vide-acces-public.png"), fullPage: true });
      await exposure.click();
      await page.getByText(/^Coupé\s*: rien n'est publié/).waitFor();
      await journey.button("Continuer").click();

      await journey.at("Et maintenant ?");
      await page.getByTestId("add-content-folders").getByText(`${MEDIA}/films`).waitFor();
      await shootHelp(journey, "fin");
      const screens = await journey.save();
      await journey.button("Ouvrir Tentacle").click();
      await page.waitForURL(`http://${ip}:${P.tentacle}/`);

      expect(titles(screens)).toEqual([
        "Bienvenue sur Tentacle", "Le code d'installation", "Jellyfin", "Connectez-vous à ce Jellyfin",
        "Ce Jellyfin n'a encore aucune bibliothèque", "Réglages conseillés", "Récapitulatif", "Installation",
        "Accès à distance (facultatif)", "Et maintenant ?",
      ]);
      // Un écran de plus, dit dès que la connexion l'a constaté.
      expect(screens.slice(4).map((s) => s.progress)).toEqual([5, 6, 7, 8, 9, 10].map((n) => `Étape ${n} sur 10`));
    });
    const state = await jellyfinState(stackJellyfin, await jellyfinToken(stackJellyfin, USER, PASSWORD));
    expect(state.libraries.map((l) => l.name).sort()).toEqual(["Films", "Séries"]);
  }, 10 * 60_000);
});

describe("B — « Salon », configuré AVEC des bibliothèques", () => {
  it("lues, jamais créées : pas d'écran des bibliothèques, et le serveur refuse", async () => {
    await reopen();
    await run("b-plein", async (journey) => {
      const { page } = journey;
      await openToChoice(journey, ip);
      await page.getByRole("radio", { name: /Salon/ }).check();
      await journey.button("Se connecter à ce Jellyfin").click();
      await signIn(journey);
      await journey.at("Réglages conseillés");
      await page.getByText(/Films · Séries/).first().waitFor();
      expect(await journey.direct("POST", "/jellyfin/libraries", { libraries: [{ name: "Intruse", type: "movies", paths: ["/media/films"] }], metadataLanguage: "fr", metadataCountry: "FR" })).toEqual(refused);
      expect(await journey.direct("GET", "/jellyfin/browse")).toEqual(refused);
      await journey.button("Passer — ne rien changer").click();
      await install(journey);
      await journey.button("Plus tard").click();
      await journey.at("Et maintenant ?");
      const screens = await journey.save();
      expect(titles(screens)).toEqual([
        "Bienvenue sur Tentacle", "Le code d'installation", "Jellyfin", "Connectez-vous à ce Jellyfin",
        "Réglages conseillés", "Récapitulatif", "Installation", "Accès à distance (facultatif)", "Et maintenant ?",
      ]);
      expect(screens.at(-1)?.progress).toBe("Étape 9 sur 9");
    });
    const state = await jellyfinState(salon.url, await salon.token(USER, PASSWORD));
    expect(state.libraries.map((l) => l.name).sort()).toEqual(["Films", "Séries"]);
  }, 10 * 60_000);
});

describe("C — un Jellyfin neuf, puis l'administration et l'interface web", () => {
  it("compte créé ; Films et Séries proposées sans dossier, choisies dans ce que voit Jellyfin", async () => {
    await reopen();
    await run("c-neuf", async (journey) => {
      const { page } = journey;
      await openToChoice(journey, ip);
      await page.getByRole("radio", { name: new RegExp(`port ${P.fresh}`) }).check();
      await journey.button("Configurer ce Jellyfin").click();
      await journey.at("Votre compte administrateur");
      await page.getByLabel("Nom d'utilisateur").fill(USER);
      await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
      await page.getByLabel("Confirmez le mot de passe").fill(PASSWORD);
      await journey.button("Préparer Jellyfin").click();

      await journey.at("Vos bibliothèques");
      await page.getByText(/Ce sont les dossiers de la machine de Jellyfin/).first().waitFor();
      expect(await journey.button("Continuer").isDisabled()).toBe(true);
      for (const folder of ["films", "series"]) {
        await journey.button("Choisir le dossier").first().click();
        for (const step of ["/", "media", folder]) {
          const entry = journey.button(step);
          await entry.first().waitFor({ timeout: step === "/" ? 5_000 : 30_000 }).then(() => entry.first().click(), () => undefined);
        }
        await page.screenshot({ path: join(PROOFS, `c-neuf-dossier-${folder}.png`), fullPage: true });
        await journey.button("Choisir ce dossier").click();
      }
      await journey.button("Continuer").click();
      await install(journey);
      await journey.button("Plus tard").click();
      await journey.at("Et maintenant ?");
      await journey.button("Ouvrir Tentacle").click();
      await page.waitForURL(`http://${ip}:${P.tentacle}/`);

      // ── L'administration : le même panneau, les mêmes règles ───────────
      await page.goto(`http://${ip}:${P.tentacle}/admin/remote-access`);
      const exposure = page.getByRole("switch", { name: "Accès depuis l'extérieur" });
      await exposure.waitFor({ timeout: 60_000 });
      await page.screenshot({ path: join(PROOFS, "d-admin-acces-prive.png"), fullPage: true });
      await exposure.click();
      await page.getByText("Votre adresse publique", { exact: true }).waitFor();
      const detected = page.getByTestId("public-ip");
      if (await detected.waitFor({ timeout: 60_000 }).then(() => true, () => false)) {
        const publicIp = (await detected.innerText()).trim();
        await journey.button("Utiliser cette adresse").click();
        await waitFor(async () => (await config()).publicUrl === `http://${publicIp}:${P.tentacle}`);
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(PROOFS, "d-admin-acces-public.png"), fullPage: true });
      await exposure.click();
      // Coupé : plus rien de public ; le jumelage des TV garde l'adresse PRIVÉE de ce serveur.
      await waitFor(async () => {
        const now = await config();
        return now.publicUrl === `http://${ip}:${P.tentacle}` && now.addresses?.public.tentacle === null;
      });
      await page.goto(`http://${ip}:${P.tentacle}/admin/services#directstreaming`);
      await page.getByText("Lecture directe depuis l'extérieur (facultatif)").waitFor({ timeout: 60_000 });
      await page.screenshot({ path: join(PROOFS, "d-admin-services.png"), fullPage: true });
    });
    const state = await jellyfinState(fresh.url, await fresh.token(USER, PASSWORD));
    expect(state.libraries.map((l) => l.name).sort()).toEqual(["Films", "Séries"]);
  }, 12 * 60_000);

  it("`tentacle web off` : le web répond 404, l'API reste ; `tentacle web on` le rallume, sans redémarrage", async () => {
    await stack.exec("tentacle", "tentacle", "web", "off");
    await waitFor(async () => (await fetchWithin(stack.url("/"))).status === 404, 30_000);
    expect((await fetchWithin(stack.url("/settings"))).status).toBe(404);
    expect((await fetchWithin(stack.url("/api/health"))).status).toBe(200);
    expect((await fetchWithin(stack.url("/api/config"))).status).toBe(200);
    await stack.exec("tentacle", "tentacle", "web", "on");
    await waitFor(async () => (await fetchWithin(stack.url("/"))).status === 200, 30_000);
  });
});

interface Config {
  publicUrl: string | null;
  addresses?: { public: { tentacle: string | null } };
}

async function config(): Promise<Config> {
  return (await fetchWithin(stack.url("/api/config"))).json() as Promise<Config>;
}

async function waitFor(probe: () => Promise<boolean>, ms = 30_000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await probe().catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("délai dépassé");
}
