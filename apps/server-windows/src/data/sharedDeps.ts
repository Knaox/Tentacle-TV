/**
 * Les dépendances partagées des extensions (`shared-deps.js`, Tailwind) :
 * l'entrypoint Docker les recopie à CHAQUE démarrage depuis la semence de
 * l'image, pour qu'une mise à jour les apporte même dans un volume ancien
 * (`docker-entrypoint.sh`, `refresh_shared_deps`). L'hôte joue ce rôle ici.
 *
 * Même geste : les fichiers de premier niveau, écrasés ; un échec ne bloque
 * pas le démarrage (`|| true` côté shell).
 */
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Rend le nombre de fichiers recopiés ; `null` si rien n'a pu l'être. */
export function refreshSharedDeps(seed: string | null, target: string): number | null {
  if (seed === null) return null;
  try {
    mkdirSync(target, { recursive: true });
    let copied = 0;
    for (const name of readdirSync(seed)) {
      const from = join(seed, name);
      if (!statSync(from).isFile()) continue;
      copyFileSync(from, join(target, name));
      copied++;
    }
    return copied;
  } catch {
    return null;
  }
}
