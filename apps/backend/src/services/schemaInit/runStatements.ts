/**
 * Rejoue les instructions de `core-init.sql` sur une connexion, en émulant
 * `PREPARE … FROM @var` / `EXECUTE` / `DEALLOCATE PREPARE`.
 *
 * Pourquoi l'émulation : le client Prisma envoie chaque requête brute en
 * protocole PRÉPARÉ, où MariaDB et MySQL refusent ces trois instructions
 * (« This command is not supported in the prepared statement protocol »).
 * Les blocs conditionnels du script (une colonne à ajouter si
 * `information_schema` dit qu'elle manque) calculent leur SQL dans une
 * variable de session : on lit cette variable, puis on exécute son texte
 * directement. Le fichier, lui, reste jouable tel quel par le client `mysql`.
 *
 * Les variables de session (`@x`) ne vivent que sur UNE connexion : l'appelant
 * doit fournir un exécutant qui n'en utilise qu'une (`connection_limit=1`).
 */
export interface SqlSession {
  /** Une instruction sans résultat attendu. */
  execute(sql: string): Promise<void>;
  /** La valeur d'une variable de session (`@nom`), en texte — `null` si elle est vide. */
  readVariable(name: string): Promise<string | null>;
}

const PREPARE_FROM_VARIABLE = /^PREPARE\s+(\w+)\s+FROM\s+@(\w+)$/i;
const EXECUTE_PREPARED = /^EXECUTE\s+(\w+)$/i;
const DEALLOCATE_PREPARED = /^(?:DEALLOCATE|DROP)\s+PREPARE\s+(\w+)$/i;

/**
 * Ce que la base a répondu. Une requête brute refusée (P2010) porte le texte
 * de MariaDB dans `meta.message`, et un `message` souvent vide.
 */
export function describeSqlError(err: unknown): string {
  const meta = (err as { meta?: { code?: unknown; message?: unknown } } | null)?.meta;
  if (meta && typeof meta.message === "string" && meta.message) {
    return meta.code ? `${meta.message} (${String(meta.code)})` : meta.message;
  }
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return String(err);
}

export class SchemaStatementError extends Error {
  constructor(
    /** Le rang (à partir de 1) de l'instruction refusée, pour la retrouver dans le fichier. */
    readonly index: number,
    readonly cause: unknown,
  ) {
    super(`instruction n°${index} refusée : ${describeSqlError(cause)}`);
  }
}

/** Joue les instructions dans l'ordre et s'arrête à la première refusée, comme le client `mysql`. */
export async function runStatements(session: SqlSession, statements: readonly string[]): Promise<void> {
  const prepared = new Map<string, string>();

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    try {
      const prepare = PREPARE_FROM_VARIABLE.exec(statement);
      if (prepare) {
        const text = await session.readVariable(prepare[2]);
        if (!text) throw new Error(`@${prepare[2]} est vide`);
        prepared.set(prepare[1].toLowerCase(), text);
        continue;
      }
      const execute = EXECUTE_PREPARED.exec(statement);
      if (execute) {
        const text = prepared.get(execute[1].toLowerCase());
        if (!text) throw new Error(`${execute[1]} n'a pas été préparée`);
        await session.execute(text);
        continue;
      }
      const deallocate = DEALLOCATE_PREPARED.exec(statement);
      if (deallocate) {
        prepared.delete(deallocate[1].toLowerCase());
        continue;
      }
      await session.execute(statement);
    } catch (err) {
      throw new SchemaStatementError(i + 1, err);
    }
  }
}
