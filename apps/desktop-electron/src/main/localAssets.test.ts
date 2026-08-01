/**
 * Ces ressources remplacent un serveur HTTP loopback protégé par un jeton. Ce
 * qui protège désormais est la liste FERMÉE des types servis et le confinement
 * de `safeJoin` : les deux se vérifient ici, parce qu'aucune des deux ne se
 * voit à l'écran tant qu'elle fonctionne.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureLayout } from "./downloads/paths";
import { LOCAL_ASSET_TOKEN, mimeFor, serveLocalAsset } from "./localAssets";

const APP_ORIGIN = "tentacle://app";
const dossiers: string[] = [];

function racinePreparee(): string {
  const root = mkdtempSync(path.join(tmpdir(), "tentacle-assets-"));
  dossiers.push(root);
  ensureLayout(root);
  mkdirSync(path.join(root, "meta", "i1"), { recursive: true });
  writeFileSync(path.join(root, "meta", "i1", "primary.jpg"), "affiche");
  writeFileSync(path.join(root, "meta", "i1", "trickplay.json"), '{"width":320}');
  mkdirSync(path.join(root, "media", "i1"), { recursive: true });
  writeFileSync(path.join(root, "media", "i1", "original-ms1.mkv"), "video");
  return root;
}

afterEach(() => {
  while (dossiers.length > 0) {
    const dir = dossiers.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

function get(pathname: string): Request {
  return new Request(`tentacle://local${pathname}`, { method: "GET" });
}

describe("types servis", () => {
  it("la liste est fermee", () => {
    expect(mimeFor("meta/i1/primary.jpg")).toBe("image/jpeg");
    expect(mimeFor("meta/i1/trickplay.json")).toBe("application/json");
    expect(mimeFor("media/i1/subs/3-fre.srt")).toBe("text/plain; charset=utf-8");
    // Les medias ne transitent JAMAIS par la webview : mpv les lit du disque.
    expect(mimeFor("media/i1/original-ms1.mkv")).toBeNull();
    expect(mimeFor("meta/i1/notes")).toBeNull();
  });

  it("l'extension est insensible a la casse", () => {
    expect(mimeFor("meta/i1/PRIMARY.JPG")).toBe("image/jpeg");
  });
});

describe("service", () => {
  it("rend l'affiche avec son type et l'en-tete CORS", async () => {
    const root = racinePreparee();

    const reponse = await serveLocalAsset(get("/meta/i1/primary.jpg"), "/meta/i1/primary.jpg", root, APP_ORIGIN);

    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("Content-Type")).toBe("image/jpeg");
    // Sans cet en-tete, les <img> passeraient mais tout fetch() serait bloque.
    expect(reponse.headers.get("Access-Control-Allow-Origin")).toBe(APP_ORIGIN);
    expect(await reponse.text()).toBe("affiche");
  });

  it("refuse un media, meme present sur le disque", async () => {
    const root = racinePreparee();
    const p = "/media/i1/original-ms1.mkv";

    expect((await serveLocalAsset(get(p), p, root, APP_ORIGIN)).status).toBe(404);
  });

  it("refuse toute traversee", async () => {
    const root = racinePreparee();
    for (const p of ["/../../secret.jpg", "/media/../../secret.jpg", "/autre/x.jpg", "/meta/%2e%2e/x.jpg"]) {
      expect((await serveLocalAsset(get(p), p, root, APP_ORIGIN)).status, p).toBe(404);
    }
  });

  it("un fichier absent est un 404, pas une erreur", async () => {
    const root = racinePreparee();
    const p = "/meta/inconnu/primary.jpg";

    expect((await serveLocalAsset(get(p), p, root, APP_ORIGIN)).status).toBe(404);
  });

  it("seul GET est servi", async () => {
    const root = racinePreparee();
    const p = "/meta/i1/primary.jpg";
    const requete = new Request(`tentacle://local${p}`, { method: "POST" });

    expect((await serveLocalAsset(requete, p, root, APP_ORIGIN)).status).toBe(405);
  });
});

describe("contrat avec la page", () => {
  it("le jeton reste NON VIDE", () => {
    // `localFiles.ts` teste `base?.base && base?.token` : une chaine vide y
    // passerait pour un echec, et plus aucune affiche locale ne s'afficherait.
    expect(LOCAL_ASSET_TOKEN.length).toBeGreaterThan(0);
  });
});
