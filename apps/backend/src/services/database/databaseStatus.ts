import { existsSync, statSync } from "fs";
import { databaseOpenError, getDatabaseFilePath, probeDatabase } from "../db";
import { databaseStorage, type DatabaseStorage } from "./storageMount";

/**
 * Ce que la carte « Base de données » de l'admin dit : moteur, chemin, taille,
 * état. Plus rien à configurer — la base est un fichier du serveur.
 */
export interface DatabaseStatus {
  status: "connected" | "error";
  /** Version de SQLite (le moteur de Prisma). */
  version: string;
  engine: "sqlite";
  path: string;
  /** Fichier principal + journal WAL, en octets. */
  sizeBytes: number;
  /** « network » : la base est sur un partage réseau, où SQLite se corrompt. */
  storage: DatabaseStorage;
  /** Pourquoi la base ne s'ouvre pas, quand elle ne s'ouvre pas. */
  error?: string;
  // Pour l'admin d'avant 1.25, encore livrée dans le bureau : « fixée par
  // l'environnement » lui fait masquer son formulaire de connexion MariaDB.
  source: "env";
  fromEnv: true;
  pendingRestart: false;
}

function fileSize(path: string): number {
  return existsSync(path) ? statSync(path).size : 0;
}

export async function databaseStatus(): Promise<DatabaseStatus> {
  const path = getDatabaseFilePath();
  const probe = await probeDatabase();
  const openError = databaseOpenError();
  return {
    status: probe.ok ? "connected" : "error",
    version: probe.ok ? probe.version : "",
    engine: "sqlite",
    path,
    sizeBytes: fileSize(path) + fileSize(`${path}-wal`),
    storage: databaseStorage(path),
    ...(!probe.ok && openError ? { error: openError } : {}),
    source: "env",
    fromEnv: true,
    pendingRestart: false,
  };
}
