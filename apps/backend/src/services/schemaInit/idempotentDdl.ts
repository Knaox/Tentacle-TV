/**
 * Rend rejouable une instruction du schéma complet (`schema-full.sql`, tiré
 * de `prisma migrate diff`), qui crée sans précaution : `CREATE TABLE`,
 * `CREATE [UNIQUE] INDEX`, `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY`.
 *
 * Pourquoi : une base peut n'être vierge qu'à moitié. Les images d'avant
 * rejouaient `core-init.sql` dès le démarrage, AVANT l'assistant ; sur une
 * base neuve, il en posait quelques tables puis butait sur une table que seul
 * `prisma db push` créait — sans `server_config`. Une telle base compte comme
 * vierge, et son schéma doit pouvoir se compléter sans échouer sur ce qui
 * existe déjà. Syntaxe de MariaDB (`FOREIGN KEY IF NOT EXISTS` compris).
 */
export function idempotentDdl(statement: string): string {
  return statement
    .replace(/^CREATE TABLE (?!IF NOT EXISTS )/i, "CREATE TABLE IF NOT EXISTS ")
    .replace(/^CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS )/i, (_match, unique: string | undefined) => `CREATE ${unique ?? ""}INDEX IF NOT EXISTS `)
    .replace(/(ADD CONSTRAINT `[^`]+` FOREIGN KEY )(?!IF NOT EXISTS )/i, "$1IF NOT EXISTS ");
}
