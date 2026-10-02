import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * La config Expo du mobile : app.json, plus la version serveur minimale prise
 * dans `versions.json → minServer` (racine du dépôt) — la source unique, celle
 * que le web et le bureau compilent déjà (`__MIN_SERVER_VERSION__`,
 * apps/web/vite.config.ts).
 *
 * POURQUOI ICI. `useServerCompat.ts` lit `Constants.expoConfig.extra.minServer`,
 * et cette config, c'est expo-constants qui l'écrit dans le binaire AU BUILD
 * NATIF (phase Xcode du pod EXConstants, tâche Gradle `createExpoConfig`), en
 * évaluant ce fichier ; `expo start` l'évalue de même en développement. Aucun
 * geste de CI ni de livraison : la copie que portait app.json, que rien ne
 * recopiait, était restée à 1.19.0 quand versions.json exigeait 1.22.0.
 *
 * Une valeur absente ou illisible ARRÊTE le build : l'app retomberait sinon sur
 * « 0.0.0 » et ne signalerait plus jamais un serveur trop ancien.
 *
 * Revers d'une config dynamique : `npx expo install` n'ajoute plus seul un
 * plugin de config dans app.json — l'y déclarer à la main.
 */
export default ({ config, projectRoot }: ConfigContext): Partial<ExpoConfig> => {
  const versionsPath = join(projectRoot, "../../versions.json");
  const { minServer } = JSON.parse(readFileSync(versionsPath, "utf8")) as { minServer?: unknown };
  if (typeof minServer !== "string" || !/^\d+\.\d+\.\d+$/.test(minServer)) {
    throw new Error(`minServer illisible dans ${versionsPath} : « ${String(minServer)} » (attendu X.Y.Z).`);
  }
  return { ...config, extra: { ...config.extra, minServer } };
};
