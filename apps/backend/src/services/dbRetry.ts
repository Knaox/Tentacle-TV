/**
 * Une écriture qui n'a pas pu PASSER, et qu'il suffit de rejouer — lecture
 * comprise, jamais en réécrivant une lecture périmée. Avec SQLite et une seule
 * connexion (docs/sqlite/DECISION.md § 5), aucun conflit ne naît dans le
 * processus ; reste l'attente :
 *
 * - P1008 : le `busy_timeout` (15 s) a expiré, un AUTRE processus tenait le
 *   verrou d'écriture (la CLI, un outil externe) ;
 * - P2028 « Unable to start a transaction » : la transaction n'a pas obtenu la
 *   connexion dans son `maxWait` (file trop longue) ;
 * - P2024 : une requête ordinaire n'a pas obtenu la connexion à temps ;
 * - P2034, « database is locked », `SQLITE_BUSY` : le conflit d'écriture dit
 *   par Prisma ou par SQLite elle-même.
 *
 * Rien n'a été écrit dans ces cas : relire et rejouer est sûr.
 */

const TRANSIENT_CODES = new Set(["P1008", "P2024", "P2034"]);

export function isWriteConflict(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  const message = String((error as { message?: unknown } | null)?.message ?? "");
  if (typeof code === "string" && TRANSIENT_CODES.has(code)) return true;
  if (code === "P2028") return /Unable to start a transaction/i.test(message);
  return /database is locked|SQLITE_BUSY/i.test(message);
}

/** Rejoue `task` — lecture comprise — sur une écriture qui n'a pas pu passer, `attempts` fois au plus. */
export async function retryOnWriteConflict<T>(task: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= attempts || !isWriteConflict(error)) throw error;
      console.log(`[db] écriture en attente, nouvel essai (${attempt + 1}/${attempts})`);
      // Laisser la file se vider avant de rejouer : 100 ms, puis 200 ms…
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
}
