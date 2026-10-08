import { Prisma, PrismaClient } from "@prisma/client";
import { prismaSqliteUrl } from "../../services/database/sqlitePath";

/**
 * Le contrôle « API » de la migration, dans un PROCESSUS ENFANT : Prisma ouvre
 * le brouillon `.migrating` comme le serveur ouvrira `tentacle.db`, compte les
 * lignes de chaque modèle et relit un échantillon — ce que les routes serviront.
 * Le processus principal n'a toujours aucun client Prisma (pas de bascule à
 * chaud) ; ce processus-ci se ferme avant le renommage.
 *
 * Entrée : argv[2] = chemin du brouillon, argv[3] = comptes attendus (JSON).
 * Sortie : un message `{ ok, problems }` — des noms de tables et des comptes.
 */
const SAMPLE = 25;

function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/** Le verdict, puis le canal fermé : le processus s'arrête de lui-même, après l'envoi. */
function reply(message: { ok: boolean; problems: string[] }): void {
  if (process.send) process.send(message, () => process.disconnect());
}

function badDate(value: unknown): boolean {
  return value !== null && !(value instanceof Date && !Number.isNaN(value.getTime()));
}

async function main(): Promise<void> {
  const [path, countsJson] = process.argv.slice(2);
  const expected = JSON.parse(countsJson ?? "{}") as Record<string, number>;
  const prisma = new PrismaClient({ datasources: { db: { url: prismaSqliteUrl(path) } } });
  const problems: string[] = [];
  try {
    for (const model of Prisma.dmmf.datamodel.models) {
      const table = model.dbName ?? model.name;
      if (!(table in expected)) continue;
      const delegate = (prisma as unknown as Record<string, { count(): Promise<number>; findMany(a: object): Promise<Array<Record<string, unknown>>> }>)[
        delegateName(model.name)
      ];
      const count = await delegate.count();
      if (count !== expected[table]) problems.push(`${table} : ${count} lignes lues par Prisma pour ${expected[table]} copiées`);
      const rows = await delegate.findMany({ take: SAMPLE });
      for (const field of model.fields) {
        if (field.kind !== "scalar") continue;
        const wrong = rows.filter((row) =>
          field.type === "DateTime" ? badDate(row[field.name]) : field.type === "Boolean" ? row[field.name] !== null && typeof row[field.name] !== "boolean" : false,
        ).length;
        if (wrong) problems.push(`${table}.${field.name} : ${wrong} valeur(s) illisible(s) par Prisma`);
      }
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
  reply({ ok: problems.length === 0, problems });
}

main().catch((err: unknown) => {
  const code = (err as { code?: unknown })?.code;
  reply({ ok: false, problems: [`Prisma n'a pas pu lire le brouillon${typeof code === "string" ? ` (${code})` : ""}`] });
});

// Le serveur qui l'a lancé disparaît (arrêt, redémarrage, remigration) : on s'arrête
// aussitôt, jamais un orphelin qui écrirait encore dans une base (ou un .bak).
process.on("disconnect", () => process.exit(0));
