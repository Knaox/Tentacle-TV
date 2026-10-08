import * as mariadb from "mariadb";
import { connectionOptions } from "../src/dbMigration/legacySource/sourceConfig";

/**
 * Une base À SOI sur la MariaDB d'intégration (`TENTACLE_TEST_MARIADB_TZ_URL`),
 * recréée vide : les fichiers de test tournent en parallèle, et une base
 * partagée voyait l'un supprimer la table que l'autre lisait (`tmdb_meta_cache`).
 * `<base de l'URL>_<nom>` ; l'URL rendue la désigne.
 */
export async function scratchDatabaseUrl(baseUrl: string, name: string): Promise<string> {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`nom de base de test invalide : ${name}`);
  const target = new URL(baseUrl);
  const database = `${target.pathname.replace(/^\//, "") || "sqlmig"}_${name}`;
  const conn = await mariadb.createConnection(connectionOptions(baseUrl));
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await conn.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await conn.end();
  }
  target.pathname = `/${database}`;
  return target.toString();
}
