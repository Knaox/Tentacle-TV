import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyServer } from "./serverConnection";

/**
 * La vérification d'une adresse de serveur dit sa cause dans le vocabulaire
 * commun : une page qui n'est pas un serveur Tentacle, un certificat refusé,
 * un HTTP bloqué, un serveur muet — en plus de la clé historique.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

const stub = (handler: (url: string) => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(handler));

describe("vérifier l'adresse d'un serveur", () => {
  it("une page qui répond sans être un serveur Tentacle", async () => {
    stub(async () => new Response("<html>Jellyfin</html>", { status: 200 }));
    await expect(verifyServer("https://jf.exemple.fr")).resolves.toMatchObject({ success: false, cause: "notTentacle" });
  });

  it("un certificat refusé en HTTPS passe devant le HTTP muet", async () => {
    stub(async (url) => {
      if (url.startsWith("https")) throw new TypeError("The certificate for this server is invalid.");
      throw new TypeError("Network request failed");
    });
    await expect(verifyServer("tentacle.lan")).resolves.toMatchObject({ success: false, cause: "certificate", errorKey: "cannotReachServer" });
  });

  it("le HTTP bloqué par l'appareil", async () => {
    stub(async () => { throw new TypeError("CLEARTEXT communication to 192.168.1.2 not permitted by network security policy"); });
    await expect(verifyServer("http://192.168.1.2:3000")).resolves.toMatchObject({ cause: "insecureBlocked" });
  });

  it("un 404 sur la santé : pas un serveur Tentacle ; muet : injoignable", async () => {
    stub(async () => new Response("", { status: 404 }));
    await expect(verifyServer("https://exemple.fr")).resolves.toMatchObject({ cause: "notTentacle", errorKey: "apiNotFound" });
    stub(async () => { throw new TypeError("Network request failed"); });
    await expect(verifyServer("https://exemple.fr")).resolves.toMatchObject({ cause: "serverUnreachable" });
  });

  it("la santé du serveur : succès, sans cause", async () => {
    stub(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 }));
    await expect(verifyServer("exemple.fr")).resolves.toEqual({ success: true, url: "https://exemple.fr" });
  });
});
