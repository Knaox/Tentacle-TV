import { readFileSync } from "fs";
import { join } from "path";

/**
 * `versions.json` à la racine du repo — la source unique des versions. Même
 * profondeur en dev (src/services) et en prod Docker (dist/services, le fichier
 * étant copié dans /app).
 */
const versions: Record<string, unknown> = (() => {
  try {
    return JSON.parse(readFileSync(join(__dirname, "../../../../versions.json"), "utf-8"));
  } catch {
    return {}; /* versions.json absent (ancienne image) → replis ci-dessous */
  }
})();

/** Version du serveur (champ `server`). Repli : package.json du backend. */
export const BACKEND_VERSION: string = (() => {
  const v = versions.server;
  if (typeof v === "string" && v) return v;
  try {
    return JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

/**
 * Époque de jumelage des téléviseurs (champ `tvPairingEpoch`).
 *
 * Un entier qui ne fait que monter. Chaque incrément vaut ordre de rejumelage
 * général : au démarrage, le serveur compare cette valeur à celle qu'il a déjà
 * appliquée et, si elle a monté, révoque TOUS les appareils jumelés. C'est le
 * seul levier qui couvre un parc — révoquer depuis l'interface est un geste
 * manuel, appareil par appareil.
 *
 * Se bump à la main dans `versions.json` : `scripts/bump-version.mjs` ne
 * connaît que les champs en X.Y.Z et n'a rien à faire ici.
 *
 * Repli à 0 : une image sans le champ ne déjumelle personne. La chaîne est
 * acceptée autant que le nombre — un `"2"` recopié à la main ne doit pas se
 * traduire par une révocation silencieusement escamotée.
 */
export const TV_PAIRING_EPOCH: number = (() => {
  const v = versions.tvPairingEpoch;
  const n = typeof v === "string" ? Number.parseInt(v, 10) : v;
  if (typeof n === "number" && Number.isFinite(n)) return Math.trunc(n);
  return 0;
})();
