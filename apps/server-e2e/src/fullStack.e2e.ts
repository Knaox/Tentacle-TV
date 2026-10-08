import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchChrome } from "./browser";
import { authHeader, jellyfinToken } from "./jellyfin";
import { SetupClient } from "./setupClient";
import { docker, fetchWithin, Stack, waitFor } from "./stack";
import { requireHostCode } from "./benchHost";

/**
 * Pile complète, Jellyfin vierge : l'assistant mené au navigateur, du code des
 * journaux (Chrome sur le Mac passe par la passerelle de colima : adresse
 * inconnue, le code est demandé) jusqu'à l'accueil — sans jamais ouvrir le tableau de bord de
 * Jellyfin. Puis l'assistant fermé pour de bon, et un film déposé dans le
 * dossier des médias que Jellyfin retrouve.
 */
const PORTS = { tentacle: 3481, jellyfin: 8981, discovery: 7361 };
const USER = "Knaoxtest";
const PASSWORD = randomBytes(12).toString("base64url");
const FILM_DIR = "/media/films/E2E Test (2026)";

const stack = new Stack({
  stack: "full",
  project: "wiz-e2e-full",
  env: { TENTACLE_PORT: String(PORTS.tentacle), JELLYFIN_PORT: String(PORTS.jellyfin), JELLYFIN_DISCOVERY_PORT: String(PORTS.discovery) },
  override: "services:\n  tentacle:\n    environment:\n      REMOTE_CHECK_URL: \"off\"\n",
});

beforeAll(() => stack.up());
afterAll(() => stack.down());

describe("pile complète, Jellyfin vierge — l'assistant au navigateur", () => {
  it("du code des journaux à l'accueil, passages réglés, bibliothèques créées", async () => {
    const code = await stack.setupCode();
    // Le verrouillage attend le premier démarrage de Jellyfin : il suit le code, il ne le précède pas.
    await waitFor("le Jellyfin voisin verrouillé", async () => (await stack.logs()).includes("[Setup] Jellyfin voisin verrouillé"), 180_000, 2_000);
    const browser = await launchChrome();
    const page = await (await browser.newContext({ locale: "fr-FR" })).newPage();
    try {
      const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
      await requireHostCode(stack.port, `127.0.0.1:${stack.port}`);
      await page.goto(stack.url(`/setup#code=${code}`));
      await button("Commencer").click();
      expect(await page.getByLabel("Code d'installation").inputValue()).toBe(code);
      await button("Valider le code").click();
      // Le Jellyfin de la pile, en tête et conseillé — jamais coché d'office : le choix est un geste.
      await page.getByText("Dans cette pile").waitFor({ timeout: 60_000 });
      expect(await page.getByRole("radio", { name: /Dans cette pile/ }).isChecked()).toBe(false);
      await page.getByRole("radio", { name: /Dans cette pile/ }).check();
      await button("Configurer ce Jellyfin").click();
      await page.getByLabel("Nom d'utilisateur").fill(USER);
      await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
      await page.getByLabel("Confirmez le mot de passe").fill(PASSWORD);
      // Plus d'écran « Langue » : proposée d'après le navigateur, elle est sous le compte.
      expect(await page.getByRole("combobox", { name: "Langue", exact: true }).inputValue()).toBe("fr");
      await button("Préparer Jellyfin").click();
      await page.getByRole("heading", { name: "Vos bibliothèques" }).waitFor({ timeout: 60_000 });
      await page.getByText("/media/films").first().waitFor();
      await button("Continuer").click();
      // L'adresse de Jellyfin des applications : l'hôte de cette page et le port publié, jamais `http://jellyfin`.
      expect(await page.getByLabel("Adresse de Jellyfin pour les applications").inputValue()).toBe(`http://127.0.0.1:${PORTS.jellyfin}`);
      await button("Installer").click();
      // La détection des passages d'abord : trois greffons, un redémarrage de Jellyfin.
      await page.getByText("Détection des passages (intro, générique)").waitFor();
      await page.getByRole("heading", { name: "Accès à distance (facultatif)" }).waitFor({ timeout: 360_000 });
      await button("Plus tard").click();
      await page.getByRole("heading", { name: "Et maintenant ?" }).waitFor();
      await button("Ouvrir Tentacle").click();
      await page.waitForURL(stack.url("/"));
    } catch (error) {
      // Ce que montrait la page à l'échec : une capture et son texte, dans le dossier de la pile.
      await page.screenshot({ path: join(stack.dir, "failure.png"), fullPage: true }).catch(() => undefined);
      writeFileSync(join(stack.dir, "failure.txt"), `${page.url()}\n\n${await page.innerText("body").catch(() => "")}`);
      throw error;
    } finally {
      await browser.close();
    }
  }, 8 * 60_000);

  it("l'assistant est fermé pour de bon : 404 partout, sauf l'état", async () => {
    const client = new SetupClient(stack.url(""));
    const status = await client.call("/status");
    expect(status.body).toMatchObject({ state: "running", setupOpen: false });
    for (const [path, method] of [["/session", "POST"], ["/context", "GET"], ["/jellyfin/libraries", "GET"]] as const) {
      expect((await client.call(path, { method, ...(method === "POST" ? { body: { token: "AAAA-BBBB-CCCC" } } : {}) })).status, path).toBe(404);
    }
    await expect(stack.exec("tentacle", "tentacle", "setup", "token")).rejects.toThrow();
  });

  it("un film déposé dans le dossier des médias est trouvé après l'analyse", async () => {
    // Le dossier et deux secondes d'image de test, faits DANS le conteneur de Jellyfin, avec son
    // ffmpeg et sous son compte : les droits du montage de l'hôte n'entrent pas en jeu. L'encodeur
    // est imposé (mpeg4, interne à ffmpeg) : sur arm64, celui par défaut est matériel (h264_rkmpp).
    const jellyfin = (await stack.compose("ps", "-q", "jellyfin")).trim();
    await docker("exec", jellyfin, "mkdir", "-p", FILM_DIR);
    await docker(
      "exec", jellyfin, "/usr/lib/jellyfin-ffmpeg/ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=24",
      "-c:v", "mpeg4", "-pix_fmt", "yuv420p", "-y", `${FILM_DIR}/E2E Test (2026).mp4`,
    );
    const base = `http://127.0.0.1:${PORTS.jellyfin}`;
    const token = await jellyfinToken(base, USER, PASSWORD);
    await fetchWithin(`${base}/Library/Refresh`, { method: "POST", headers: authHeader(token) });
    // Par son CHEMIN : son nom devient celui que trouve la source de métadonnées (mesuré : un titre sans
    // rapport, reconnu en ligne), la recherche par nom ne le retrouverait pas.
    const found = await waitFor("le film dans Jellyfin", async () => {
      const res = await fetchWithin(`${base}/Items?IncludeItemTypes=Movie&Recursive=true&Fields=Path`, { headers: authHeader(token) });
      const { Items } = (await res.json()) as { Items: Array<{ Path?: string }> };
      return Items.find((item) => item.Path?.startsWith(`${FILM_DIR}/`)) ?? null;
    }, 120_000, 3_000);
    expect(found.Path).toBe(`${FILM_DIR}/E2E Test (2026).mp4`);
  });
});
