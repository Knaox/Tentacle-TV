/**
 * La pile des bancs de panne : une MariaDB 11 jetable, le faux Jellyfin, et
 * le VRAI backend Tentacle configuré sur lui. Partagée par le banc du
 * protocole (`run.ts`) et celui du lecteur web (`runWeb.ts`).
 */

import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { seedBackendConfig, startBackend, startDatabase, stopDatabase } from "../jellyfin-compat/backendEnv";
import { assertDockerReady } from "../jellyfin-compat/docker";
import type { BackendProcess } from "../notif-e2e/benchEnv";
import { API_KEY, FakeJellyfin, type FakeUser } from "./fakeJellyfin";

export interface Stack {
  fake: FakeJellyfin;
  backend: BackendProcess;
  stop(): Promise<void>;
}

export interface StackOptions {
  users: FakeUser[];
  runDir: string;
  fakePort: number;
  backendPort: number;
  db: { name: string; port: number };
  keep: boolean;
  /** Lignes `server_config` en plus (ex. streaming direct coupé pour le banc web). */
  config?: Record<string, string>;
  log: (line: string) => void;
}

export async function startStack(opts: StackOptions, prepare?: (fake: FakeJellyfin) => void): Promise<Stack> {
  assertDockerReady();
  const fake = new FakeJellyfin(opts.fakePort, opts.users);
  prepare?.(fake);
  await fake.start();
  opts.log(`faux Jellyfin sur ${fake.url}`);
  const dbUrl = await startDatabase(opts.db, opts.log);
  await seedBackendConfig(dbUrl, { jellyfinUrl: fake.url, apiKey: API_KEY, adminUserId: opts.users[0].Id });
  if (opts.config) {
    const prisma = new PrismaClient({ datasourceUrl: dbUrl });
    try {
      for (const [key, value] of Object.entries(opts.config)) {
        await prisma.serverConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
      }
    } finally {
      await prisma.$disconnect();
    }
  }
  const backend = await startBackend({ port: opts.backendPort, dbUrl, runDir: opts.runDir });
  opts.log(`backend sur ${backend.url} (journal : ${join(opts.runDir, "backend.log")})`);
  return {
    fake,
    backend,
    async stop() {
      await backend.stop();
      await fake.stop();
      if (!opts.keep) stopDatabase(opts.db);
    },
  };
}
