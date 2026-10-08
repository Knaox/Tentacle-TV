import { databaseMigrationOf, isMigrationMaintenance, type DatabaseMigrationView } from "@tentacle-tv/shared";

/**
 * Ce que le serveur a DIT de sa base (serveur 1.25, migration MariaDB → SQLite),
 * lisible hors de React : les sondes de connectivité de chaque plateforme et
 * `fetchWithRetry` y déposent ce qu'elles ont lu, la porte de l'écran d'attente
 * (`useDatabaseMigrationGate`) le lit.
 *
 * Un DIRE, pas une décision : la porte ne montre l'écran qu'une fois la
 * capacité `server.databaseMigration` relue sur le serveur — un dépôt d'un
 * serveur qui ne la déclare pas est effacé sans rien montrer.
 */

let current: DatabaseMigrationView | null = null;
const listeners = new Set<() => void>();

const notify = (): void => listeners.forEach((listener) => listener());

const sameView = (a: DatabaseMigrationView | null, b: DatabaseMigrationView | null): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** Une vue déjà lue (la relecture de la porte). */
export function publishDatabaseMigration(next: DatabaseMigrationView | null): void {
  if (sameView(current, next)) return;
  current = next;
  notify();
}

/**
 * Un corps lu sur le serveur : celui de `/api/health` (`database`) ou celui
 * d'un 503 du mode maintenance. Vrai si la base n'est PAS prête — l'appelant
 * le prend alors pour un serveur qui répond, jamais pour une panne.
 */
export function reportDatabaseState(body: unknown): boolean {
  const view = databaseMigrationOf(body);
  if (view) publishDatabaseMigration(view);
  return view !== null;
}

/**
 * Une réponse HTTP quelconque du serveur : un 503 du mode maintenance est
 * déposé et dit `true`. Lit une COPIE du corps (l'appelant garde le sien) ;
 * tout le reste dit `false` sans rien lire.
 */
export async function reportMaintenanceResponse(response: Response): Promise<boolean> {
  if (response.status !== 503) return false;
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return false;
  }
  if (!isMigrationMaintenance(response.status, body)) return false;
  // Le corps du 503 porte `database` ; à défaut, sa progression suffit.
  if (!reportDatabaseState(body)) {
    reportDatabaseState({ database: { state: "migrating", progress: (body as { progress?: unknown }).progress } });
  }
  return true;
}

/** La base est prête (ou l'épisode est abandonné) : plus rien à montrer. */
export function clearDatabaseMigration(): void {
  publishDatabaseMigration(null);
}

export function readDatabaseMigration(): DatabaseMigrationView | null {
  return current;
}

export function subscribeDatabaseMigration(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
