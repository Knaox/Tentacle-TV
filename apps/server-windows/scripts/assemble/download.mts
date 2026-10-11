/**
 * Téléchargements épinglés, gardés en cache entre deux assemblages.
 *
 * Un fichier n'est rendu QUE si son SHA-256 est celui de l'épingle : en cache
 * comme fraîchement téléchargé. Une copie en cache qui ne correspond plus est
 * jetée et retéléchargée ; un téléchargement qui ne correspond pas arrête tout.
 * Rien n'est exécuté ici : l'archive est une donnée jusqu'à sa vérification.
 */
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PinnedFile } from "./pins.mts";

export function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

async function fetchBytes(url: string): Promise<Buffer> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${url} : HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function fetchText(url: string): Promise<string> {
  return (await fetchBytes(url)).toString("utf8");
}

/** Le chemin du fichier vérifié dans `cacheDir`. */
export async function fetchPinned(pin: PinnedFile, cacheDir: string, log: (line: string) => void): Promise<string> {
  mkdirSync(cacheDir, { recursive: true });
  const target = join(cacheDir, pin.fileName);
  if (existsSync(target)) {
    if ((await sha256File(target)) === pin.sha256) {
      log(`${pin.name} ${pin.version} : en cache, empreinte vérifiée`);
      return target;
    }
    log(`${pin.name} ${pin.version} : copie en cache altérée, retéléchargée`);
    rmSync(target);
  }
  log(`${pin.name} ${pin.version} : téléchargement de ${pin.url}`);
  const bytes = await fetchBytes(pin.url);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== pin.sha256) {
    throw new Error(`${pin.name} ${pin.version} : empreinte ${actual}, attendue ${pin.sha256} — rien n'est gardé`);
  }
  const partial = `${target}.partial`;
  writeFileSync(partial, bytes);
  renameSync(partial, target);
  log(`${pin.name} ${pin.version} : empreinte vérifiée`);
  return target;
}
