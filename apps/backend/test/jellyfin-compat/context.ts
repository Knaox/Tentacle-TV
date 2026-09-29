/**
 * Ce que le lanceur (`run.ts`) transmet aux suites vitest : l'instance
 * Jellyfin préparée, ses comptes, ses titres, et le backend Tentacle qui la
 * sert. Écrit en JSON dans le dossier du passage, relu par chaque suite.
 */

import { readFileSync } from "node:fs";
import type { Account, Library } from "./provision";
import type { Fixtures } from "./fixtures";

export interface CompatContext {
  jellyfin: {
    url: string;
    /** La version EXACTE que rapporte `/System/Info/Public` (« 12.1.0 »). */
    version: string;
    image: string;
    serverId: string;
    /** Autorisation héritée acceptée ? `null` : la version n'a pas l'option (toujours acceptée). */
    legacyAuth: boolean | null;
  };
  apiKey: string;
  admin: Account;
  user: Account;
  user2: Account;
  libraries: Library[];
  fixtures: Fixtures;
  backend: {
    url: string;
    /** Secret de signature des jetons d'appareil (base jetable du passage). */
    jwtSecret: string;
    databaseUrl: string;
  };
  /** Où chaque contrôle consigne son verdict (une ligne JSON par contrôle). */
  recordFile: string;
  /** Le document OpenAPI de l'instance, pour vérifier les endpoints déclarés. */
  openapiFile: string;
}

export const CONTEXT_ENV = "TENTACLE_JF_COMPAT_CONTEXT";

let cached: CompatContext | null = null;

export function loadContext(): CompatContext {
  if (cached) return cached;
  const file = process.env[CONTEXT_ENV];
  if (!file) throw new Error(`${CONTEXT_ENV} absent : lancer la suite par \`pnpm test:jellyfin-compat\`, pas vitest seul.`);
  cached = JSON.parse(readFileSync(file, "utf8")) as CompatContext;
  return cached;
}
