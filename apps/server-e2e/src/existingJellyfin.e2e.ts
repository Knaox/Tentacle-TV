import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DisposableJellyfin } from "./jellyfin";
import { jellyfinState } from "./jellyfinSetupProbe";
import { errorOf, SetupClient } from "./setupClient";
import { docker, Stack, waitFor } from "./stack";
import { HOST_ADDRESS } from "./benchHost";

/**
 * Pile « seule » (Tentacle, sa base SQLite) devant un Jellyfin DÉJÀ configuré (10.11 et 12.1),
 * l'assistant mené par HTTP comme le fait l'interface — et sa sécurité :
 * pas de session, code rejoué, force brute, adresses interdites, mauvaise
 * clé, Jellyfin arrêté en chemin, aucun secret qui ressorte, fermé à la fin.
 *
 *   E2E_JELLYFIN_TAGS  les versions éprouvées (défaut « 10.11,12.1 »)
 */
const TAGS = (process.env.E2E_JELLYFIN_TAGS ?? "10.11,12.1").split(",").map((t) => t.trim()).filter(Boolean);
const USER = "Knaoxtest";

/** Un petit serveur qui renvoie vers l'adresse des métadonnées du nuage : la sonde ne doit jamais le suivre. */
async function startRedirector(name: string, port: number, dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "default.conf"), "server { listen 80; location / { return 302 http://169.254.169.254/latest/meta-data/; } }\n");
  await docker("rm", "-f", name).catch(() => undefined);
  await docker("run", "-d", "--name", name, "-p", `${port}:80`, "-v", `${join(dir, "default.conf")}:/etc/nginx/conf.d/default.conf:ro,z`, "nginx:alpine");
}

TAGS.forEach((tag, index) => {
  const safe = tag.replace(/\W/g, "");
  const ports = { tentacle: 3482 + index * 10, jellyfin: 8982 + index * 10, redirector: 3592 + index * 10 };
  const password = randomBytes(12).toString("base64url");
  const stack = new Stack({
    stack: "only",
    project: `wiz-e2e-db${safe}`,
    env: { TENTACLE_PORT: String(ports.tentacle) },
    override: "services:\n  tentacle:\n    environment:\n      REMOTE_CHECK_URL: \"off\"\n",
  });
  const jellyfin = new DisposableJellyfin(`wiz-e2e-jf${safe}`, ports.jellyfin, tag, join(stack.dir, "jellyfin-media"));
  const redirector = `wiz-e2e-redirect${safe}`;
  const jellyfinUrl = `http://${HOST_ADDRESS}:${ports.jellyfin}`;
  const client = new SetupClient(stack.url(""));

  describe(`Jellyfin ${tag} existant — assistant et sécurité`, () => {
    beforeAll(async () => {
      mkdirSync(jellyfin.media, { recursive: true });
      await jellyfin.start();
      await jellyfin.completeStartup(USER, password);
      await startRedirector(redirector, ports.redirector, join(stack.dir, "redirector"));
      await stack.up();
    });
    afterAll(async () => {
      await stack.down();
      await jellyfin.remove();
      await docker("rm", "-f", redirector).catch(() => undefined);
    });

    it("sans session, rien : 401", async () => {
      const reply = await client.call("/context");
      expect(reply.status).toBe(401);
      expect(errorOf(reply)).toBe("session_required");
    });

    it("force brute : cinq codes faux par minute et par adresse, puis 429", async () => {
      // Une autre adresse que celle des étapes suivantes : la passerelle Docker, voisine, est crue.
      const elsewhere = { "x-forwarded-for": "198.51.100.77" };
      for (let i = 0; i < 5; i++) {
        const wrong = await client.call("/session", { method: "POST", body: { token: "AAAA-BBBB-CCCC" }, headers: elsewhere, withSession: false });
        expect(errorOf(wrong)).toBe("invalid_token");
      }
      const blocked = await client.call("/session", { method: "POST", body: { token: "AAAA-BBBB-CCCC" }, headers: elsewhere, withSession: false });
      expect(blocked.status).toBe(429);
    });

    it("le code ne sert qu'une fois", async () => {
      // Cinq codes faux ne le font pas tourner (il en faut dix) ; on lit quand même le DERNIER annoncé.
      const code = await stack.setupCode();
      expect((await client.open(code)).status).toBe(200);
      const again = await new SetupClient(stack.url("")).open(code);
      expect(errorOf(again)).toBe("invalid_token");
    });

    it("la sonde refuse les adresses interdites, et ne suit aucune redirection", async () => {
      const probe = (url: string) => client.call("/jellyfin/probe", { method: "POST", body: { url } });
      expect(errorOf(await probe("http://169.254.169.254/latest/meta-data/"))).toBe("jf_forbidden_address");
      expect(errorOf(await probe("file:///etc/passwd"))).toMatch(/^(jf_invalid_url|invalid_input)$/);
      expect(errorOf(await probe("http://localhost:8096"))).toBe("jf_localhost_in_docker");
      const redirected = await probe(`http://${HOST_ADDRESS}:${ports.redirector}`);
      expect(redirected.status).not.toBe(200);
      expect(errorOf(redirected)).toMatch(/^(jf_not_jellyfin|jf_forbidden_address)$/);
      expect(errorOf(await probe(`http://${HOST_ADDRESS}:8999`))).toMatch(/^(jf_unreachable|jf_timeout)$/);
      // Podman sans racine : l'hôte est 169.254.1.2 (lien local), accepté sous son NOM seulement — tapée, l'adresse reste refusée.
      const hostIp = (await stack.exec("tentacle", "getent", "hosts", HOST_ADDRESS)).trim().split(/\s+/)[0] ?? "";
      if (hostIp.startsWith("169.254.")) expect(errorOf(await probe(`http://${hostIp}:${ports.jellyfin}`))).toBe("jf_forbidden_address");
    });

    it("Jellyfin configuré : sondé, puis rejoint par le compte (mauvais mot de passe et mauvaise clé refusés)", async () => {
      const probed = await client.call("/jellyfin/probe", { method: "POST", body: { url: jellyfinUrl } });
      expect(probed.body).toMatchObject({ blank: false, compatible: true });
      // Sans choix, rien : puis le choix, qui fixe le parcours « déjà configuré ».
      expect(errorOf(await client.call("/jellyfin/connect", { method: "POST", body: { url: jellyfinUrl, username: USER, password } }))).toBe("step_refused");
      expect((await client.call("/jellyfin/select", { method: "POST", body: { url: jellyfinUrl } })).status).toBe(200);
      expect(errorOf(await client.call("/jellyfin/connect", { method: "POST", body: { url: jellyfinUrl, username: USER, password: "faux-mot-de-passe" } }))).toBe("jf_bad_credentials");
      expect(errorOf(await client.call("/jellyfin/connect", { method: "POST", body: { url: jellyfinUrl, apiKey: "0123456789abcdef0123456789abcdef" } }))).toBe("jf_api_key_invalid");
      expect((await client.call("/jellyfin/connect", { method: "POST", body: { url: jellyfinUrl, username: USER, password } })).status).toBe(200);
    });

    it("Jellyfin arrêté en chemin : une erreur lisible, puis la reprise", async () => {
      await jellyfin.stop();
      const down = await client.call("/jellyfin/libraries");
      expect(down.status).not.toBe(200);
      expect(errorOf(down)).toMatch(/^jf_/);
      await jellyfin.resume();
      await waitFor("les bibliothèques de nouveau lisibles", async () => (await client.call("/jellyfin/libraries")).status === 200, 120_000, 3_000);
    });

    it("déjà configuré : jamais un compte ; des bibliothèques seulement tant qu'il n'en avait AUCUNE à la connexion", async () => {
      await docker("exec", jellyfin.name, "mkdir", "-p", "/media/films", "/media/series");
      const account = await client.call("/jellyfin/initialize", {
        method: "POST",
        body: { url: jellyfinUrl, username: "Intrus", password: "mot-de-passe-intrus", uiCulture: "fr", metadataCountry: "CH", metadataLanguage: "fr" },
      });
      expect(errorOf(account)).toBe("step_refused");
      // Configuré mais sans bibliothèque (le cas vécu sous Portainer) : en créer est permis.
      const library = (name: string, path: string) => ({ method: "POST" as const, body: { libraries: [{ name, type: "movies", paths: [path] }], metadataLanguage: "fr", metadataCountry: "CH" } });
      expect((await client.call("/jellyfin/libraries", library("Films", "/media/films"))).body).toEqual([{ name: "Films", status: "created" }]);
      // Reconnecté, il en a une : plus rien ne s'y crée.
      expect((await client.call("/jellyfin/connect", { method: "POST", body: { url: jellyfinUrl, username: USER, password } })).status).toBe(200);
      expect(errorOf(await client.call("/jellyfin/libraries", library("Séries", "/media/series")))).toBe("step_refused");
      const state = await jellyfinState(jellyfin.url, await jellyfin.token(USER, password));
      expect(state.libraries.map((l) => l.name)).toEqual(["Films"]);
    });

    it("la clé d'API et le mot de passe ne ressortent jamais : ni réponse, ni journal", async () => {
      const token = await jellyfin.token(USER, password);
      const key = (await jellyfin.keys(token)).find((k) => k.AppName === "Tentacle")?.AccessToken;
      expect(key).toBeTruthy();
      const logs = await stack.logs();
      for (const secret of [key as string, password]) {
        expect(client.seen.some((body) => body.includes(secret))).toBe(false);
        expect(logs.includes(secret)).toBe(false);
      }
    });

    it("fin : la session ouverte, puis l'assistant fermé pour de bon", async () => {
      const done = await client.call("/complete", { method: "POST", body: { username: USER, password } });
      expect(done.status).toBe(200);
      expect(done.body).toMatchObject({ success: true, User: { Name: USER } });
      expect((await client.call("/status")).body).toMatchObject({ setupOpen: false });
      expect((await client.call("/context")).status).toBe(404);
    });
  });
});
