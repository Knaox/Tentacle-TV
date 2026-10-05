import { applyDatabaseSchema } from "./coreSchema";

/**
 * Le schéma posé ou mis à jour, sans jamais empêcher le serveur de démarrer :
 * un refus est dit dans le journal, et le serveur reste en mode installation
 * si sa base est inutilisable — c'était déjà le comportement de l'entrypoint.
 */
export async function ensureDatabaseSchema(databaseUrl: string): Promise<boolean> {
  try {
    const result = await applyDatabaseSchema(databaseUrl);
    const what = result.bootstrapped ? "base vierge : schéma complet posé, puis core-init.sql" : "core-init.sql";
    console.log(`[Schema] ${what} appliqué (${result.statements} instructions)`);
    return true;
  } catch (err) {
    console.warn(`[Schema] ${err instanceof Error ? err.message : String(err)} — le serveur démarre quand même`);
    return false;
  }
}
