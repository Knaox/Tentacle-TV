import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { lanIp, requireHostCode } from "./benchHost";
import { DisposableJellyfin } from "./jellyfin";

export { lanIp };
import { configureExisting } from "./jellyfinSetupProbe";
import { hostCall } from "./lanClient";
import type { Journey } from "./setupJourney";
import { REPO, Stack, waitFor } from "./stack";

/**
 * Le banc de l'assistant v3 : une pile complète « comme sous Portainer »
 * (Tentacle 47330, son Jellyfin 47910), ouverte par l'IP LOCALE de la machine
 * (`lanIp`, `benchHost.ts`) — comme
 * Damien ouvre http://172.16.1.30:47300 — et deux Jellyfin à côté : « Salon »,
 * déjà configuré AVEC des bibliothèques (47920), et un neuf (47921). Le Jellyfin
 * de la pile est d'abord configuré SANS bibliothèque par un premier essai :
 * le cas vécu. Conteneurs `av3-*`, supprimés à la fin.
 */
export const USER = "Knaoxtest";
export const PASSWORD = "av3-banc-mot-de-passe";
export const P = { tentacle: 47330, jellyfin: 47910, discovery: 47366, salon: 8096, fresh: 8097 };
export const MEDIA = join(REPO, "apps/server-e2e/.runs/av3-media");
const OTHERS = join(REPO, "apps/server-e2e/.runs/av3-jellyfins");
export const PROOFS = process.env.E2E_PROOF_DIR ?? join(REPO, "apps/server-e2e/.runs/av3-proofs");

export const salon = new DisposableJellyfin("av3-jf-salon", P.salon, "12.1", OTHERS);
export const fresh = new DisposableJellyfin("av3-jf-neuf", P.fresh, "12.1", OTHERS);
export const stack = new Stack({
  stack: "full",
  project: "av3-full",
  env: { TENTACLE_PORT: String(P.tentacle), JELLYFIN_PORT: String(P.jellyfin), JELLYFIN_DISCOVERY_PORT: String(P.discovery), MEDIA_PATH: MEDIA },
});
export const stackJellyfin = `http://127.0.0.1:${P.jellyfin}`;

/** Tout monter ; le Jellyfin de la pile configuré par un premier essai, SANS bibliothèque ; l'assistant rouvert. */
export async function prepare(): Promise<void> {
  for (const dir of [join(MEDIA, "films"), join(MEDIA, "series"), join(OTHERS, "films"), join(OTHERS, "series"), PROOFS]) mkdirSync(dir, { recursive: true });
  await Promise.all([salon.start(), fresh.start(), stack.up()]);
  await salon.completeStartup(USER, PASSWORD);
  await configureExisting(salon.url, await salon.token(USER, PASSWORD));
  await waitFor("le Jellyfin de la pile verrouillé", async () => (await stack.logs()).includes("[Setup] Jellyfin voisin verrouillé"), 180_000);
  const at = { host: `${lanIp()}:${P.tentacle}` };
  const session = ((await hostCall(P.tentacle, { ...at, path: "/session", method: "POST", body: { token: await stack.setupCode() } })).body as { session: string }).session;
  const call = (path: string, body: unknown) => hostCall(P.tentacle, { ...at, path, method: "POST", body, session });
  expect((await call("/jellyfin/select", { url: "" })).status).toBe(200);
  const init = await call("/jellyfin/initialize", { url: "http://jellyfin:8096", username: USER, password: PASSWORD, serverName: "Tentacle", uiCulture: "fr", metadataCountry: "FR", metadataLanguage: "fr" });
  expect(init.status, JSON.stringify(init.body)).toBe(200);
  expect((await call("/complete", { username: USER, password: PASSWORD })).status).toBe(200);
  await reopen();
}

/** `tentacle setup reset`, puis le redémarrage — ce que Damien fait sous Portainer. */
export async function reopen(): Promise<void> {
  await stack.exec("tentacle", "tentacle", "setup", "reset");
  await stack.compose("restart", "tentacle");
  await stack.waitHealthy();
}

export async function teardown(): Promise<void> {
  await stack.down();
  await salon.remove();
  await fresh.remove();
}

/** L'assistant ouvert par l'IP locale de la machine : accueil, code, jusqu'au choix du Jellyfin. */
export async function openToChoice(journey: Journey, ip: string): Promise<void> {
  await requireHostCode(P.tentacle, `${ip}:${P.tentacle}`);
  await journey.page.goto(`http://${ip}:${P.tentacle}/setup#code=${await stack.setupCode()}`);
  await journey.at("Bienvenue sur Tentacle");
  await journey.button("Commencer").click();
  await journey.at("Le code d'installation");
  await journey.button("Valider le code").click();
  await journey.at("Jellyfin");
  await journey.page.getByText("Salon").first().waitFor({ timeout: 120_000 });
}

/** La connexion à un Jellyfin déjà configuré, avec son compte existant. */
export async function signIn(journey: Journey): Promise<void> {
  await journey.at("Connectez-vous à ce Jellyfin");
  await journey.page.getByLabel("Nom d'utilisateur").fill(USER);
  await journey.page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await journey.button("Se connecter").click();
}

/** Récapitulatif → Installer → Accès à distance (laissé coupé) → Et maintenant ? */
export async function install(journey: Journey): Promise<void> {
  await journey.at("Récapitulatif");
  await journey.button("Installer").click();
  await journey.at("Accès à distance (facultatif)");
}

/** Ouvre « Besoin d'aide ? » de l'écran, le capture, le referme. */
export async function shootHelp(journey: Journey, name: string): Promise<void> {
  const help = journey.page.getByTestId("setup-help");
  await help.locator("summary").click();
  await help.getByRole("link", { name: "Lire la page d'aide" }).waitFor();
  await help.screenshot({ path: join(PROOFS, `${journey.prefix}-aide-${name}.png`) });
  await help.locator("summary").click();
}
