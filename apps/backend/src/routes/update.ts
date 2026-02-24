import type { FastifyPluginAsync } from "fastify";
import fs from "fs";
import path from "path";

/**
 * Tauri Updater endpoint.
 *
 * Serves update metadata from a local JSON file or environment config.
 * When a new version is released, update the UPDATE_JSON_PATH file
 * or the UPDATE_* environment variables.
 *
 * Tauri expects a response with:
 * - 204 No Content: no update available
 * - 200 OK: update available, with JSON body containing version, url, signature, notes
 */

const UPDATE_DIR = process.env.UPDATE_DIR || path.join(process.cwd(), "updates");

interface UpdateManifest {
  version: string;
  notes?: string;
  platforms: Record<string, {
    url: string;
    signature: string;
  }>;
}

export const updateRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/update/:target/:arch/:currentVersion
  app.get("/:target/:arch/:currentVersion", async (request, reply) => {
    const { target, arch, currentVersion } = request.params as {
      target: string;
      arch: string;
      currentVersion: string;
    };

    // Try to read the update manifest
    const manifestPath = path.join(UPDATE_DIR, "latest.json");
    let manifest: UpdateManifest;

    try {
      const raw = fs.readFileSync(manifestPath, "utf-8");
      manifest = JSON.parse(raw);
    } catch {
      // No update manifest found — no update available
      return reply.status(204).send();
    }

    // Compare versions
    if (!isNewer(manifest.version, currentVersion)) {
      return reply.status(204).send();
    }

    // Find platform-specific update
    const platformKey = `${target}-${arch}`;
    const platform = manifest.platforms[platformKey]
      || manifest.platforms[target]
      || null;

    if (!platform) {
      return reply.status(204).send();
    }

    return reply.send({
      version: manifest.version,
      notes: manifest.notes || `Mise à jour ${manifest.version}`,
      pub_date: new Date().toISOString(),
      url: platform.url,
      signature: platform.signature,
    });
  });
};

/**
 * Simple semver comparison: returns true if `latest` is newer than `current`.
 */
function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const l = parse(latest);
  const c = parse(current);

  for (let i = 0; i < 3; i++) {
    const lv = l[i] || 0;
    const cv = c[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}
