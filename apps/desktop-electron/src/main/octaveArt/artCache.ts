/**
 * Octave — le cache disque des pochettes (bureau) : LA source de toute
 * pochette d'Octave. Une pochette déjà là est servie depuis le disque, sans
 * réseau (hors ligne compris) ; sinon elle est demandée UNE fois, vérifiée
 * (vraie image, taille bornée), écrite, puis servie. Rangé par identité
 * (`<racine>/<empreinte de l'identité>/<empreinte de la clé>`), borné
 * (`artCachePolicy.ts`), effacé en entier à la déconnexion.
 *
 * Aucun jeton n'est ajouté ici : une adresse du serveur arrive avec celui que
 * la page y met déjà (comme une `<img>`), une adresse d'un autre hôte n'en a
 * jamais. Le réseau est injecté (tests) ; `serveArt.ts` branche `net.fetch`.
 */

import { createHash } from "node:crypto";
import { mkdir, open, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ART_MAX_BYTES, artEvictionPlan, artKey, isFreshArt, sniffImageType, type ArtFile } from "./artCachePolicy";

export interface ArtCacheDeps {
  root: string;
  /** La ressource, ou null (réseau, refus, corps trop gros). */
  fetchUpstream: (url: string, maxBytes: number) => Promise<Uint8Array | null>;
  now?: () => number;
  /** L'éviction tourne toutes les tant d'écritures (et à la première). */
  evictEvery?: number;
}

export interface ServedArt {
  bytes: Uint8Array;
  type: string;
  /** Servie depuis le disque (aucune requête). */
  fromDisk: boolean;
}

const hash = (text: string, length = 40) => createHash("sha256").update(text).digest("hex").slice(0, length);

export function ownerDirOf(owner: string | null): string {
  return owner ? hash(owner, 24) : "anonyme";
}

export function createArtCache(deps: ArtCacheDeps) {
  const now = deps.now ?? Date.now;
  const evictEvery = deps.evictEvery ?? 25;
  const inFlight = new Map<string, Promise<ServedArt | null>>();
  let writes = 0;

  async function readFresh(file: string, key: string): Promise<ServedArt | null> {
    // UN descripteur pour la date, la lecture et l'heure d'accès : un fichier remplacé (écriture concurrente,
    // éviction) entre deux appels par chemin ne mêle plus la date de l'un aux octets de l'autre.
    const handle = await open(file, "r").catch(() => null);
    if (!handle) return null;
    try {
      const info = await handle.stat();
      const writtenAt = info.birthtimeMs > 0 ? info.birthtimeMs : info.mtimeMs;
      if (!isFreshArt(key, writtenAt, now())) return null;
      const bytes = new Uint8Array(await handle.readFile());
      const type = sniffImageType(bytes);
      if (!type) return null;
      // L'heure d'accès sert l'éviction (les moins récemment servies partent d'abord).
      const at = new Date(now());
      await handle.utimes(at, at).catch(() => undefined);
      return { bytes, type, fromDisk: true };
    } catch {
      return null;
    } finally {
      await handle.close().catch(() => undefined);
    }
  }

  async function evict(currentOwnerDir: string): Promise<void> {
    const files: ArtFile[] = [];
    for (const owner of await readdir(deps.root).catch(() => [] as string[])) {
      const dir = path.join(deps.root, owner);
      for (const name of await readdir(dir).catch(() => [] as string[])) {
        if (name.endsWith(".part")) continue;
        const file = path.join(dir, name);
        const info = await stat(file).catch(() => null);
        if (info?.isFile()) files.push({ owner, path: file, size: info.size, usedAt: info.mtimeMs });
      }
    }
    for (const file of artEvictionPlan(files, currentOwnerDir)) await rm(file, { force: true }).catch(() => undefined);
  }

  async function fetchAndStore(file: string, upstream: string, ownerDir: string): Promise<ServedArt | null> {
    const bytes = await deps.fetchUpstream(upstream, ART_MAX_BYTES).catch(() => null);
    const type = bytes ? sniffImageType(bytes) : null;
    if (!bytes || !type || bytes.byteLength > ART_MAX_BYTES) return null;
    try {
      await mkdir(path.dirname(file), { recursive: true });
      const part = `${file}.${process.pid}.part`;
      await writeFile(part, bytes);
      await rename(part, file);
      writes += 1;
      if (writes === 1 || writes % evictEvery === 0) void evict(ownerDir).catch(() => undefined);
    } catch {
      /* disque plein ou refusé : l'image est servie quand même, elle sera redemandée */
    }
    return { bytes, type, fromDisk: false };
  }

  return {
    /** La pochette de `upstream` pour cette identité : depuis le disque si elle y est, sinon demandée une fois. */
    async serve(owner: string | null, upstream: string): Promise<ServedArt | null> {
      const key = artKey(upstream);
      if (key === null) return null;
      const ownerDir = ownerDirOf(owner);
      const file = path.join(deps.root, ownerDir, hash(key));
      const cached = await readFresh(file, key);
      if (cached) return cached;
      const running = inFlight.get(file);
      if (running) return running;
      const job = fetchAndStore(file, upstream, ownerDir).finally(() => inFlight.delete(file));
      inFlight.set(file, job);
      return job;
    },
    /** La déconnexion : tout part, toutes identités. */
    async clear(): Promise<void> {
      await rm(deps.root, { recursive: true, force: true });
    },
  };
}

export type ArtCache = ReturnType<typeof createArtCache>;
