import { readFileSync } from "fs";
import { join } from "path";

/**
 * Version du serveur — source unique : `versions.json` à la racine du repo
 * (champ `server`). Même profondeur en dev (src/services) et en prod Docker
 * (dist/services, versions.json copié dans /app). Fallback : package.json
 * du backend (anciennes images), puis "0.0.0".
 */
export const BACKEND_VERSION: string = (() => {
  try {
    const v = JSON.parse(readFileSync(join(__dirname, "../../../../versions.json"), "utf-8")).server;
    if (typeof v === "string" && v) return v;
  } catch { /* versions.json absent (ancienne image) → fallback */ }
  try {
    return JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();
