/**
 * Le poids du paquet, par grand poste : ce qui pèse se voit à chaque
 * assemblage, et un saut (une dépendance qui ramène un binaire, un élagage
 * qui ne prend plus) se remarque sans chercher.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface SizeEntry {
  part: string;
  bytes: number;
  files: number;
}

/** Les postes suivis, du plus précis au plus large ; le premier préfixe qui correspond gagne. */
const PARTS = [
  "node_modules/.prisma",
  "node_modules",
  "apps/web",
  "apps/tv-webos",
  "apps/backend",
  "apps/server-windows",
  "python",
  "tools",
  "shared-deps-seed",
  "Assets",
] as const;

export function partOf(relativePath: string): string {
  const path = relativePath.split(sep).join("/");
  return PARTS.find((part) => path === part || path.startsWith(`${part}/`)) ?? (path.includes("/") ? "(autres)" : path);
}

export function measure(root: string): { total: number; files: number; parts: SizeEntry[] } {
  const parts = new Map<string, SizeEntry>();
  let total = 0;
  let files = 0;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      const bytes = statSync(path).size;
      const part = partOf(relative(root, path));
      const current = parts.get(part) ?? { part, bytes: 0, files: 0 };
      current.bytes += bytes;
      current.files += 1;
      parts.set(part, current);
      total += bytes;
      files += 1;
    }
  };
  walk(root);
  return { total, files, parts: [...parts.values()].sort((a, b) => b.bytes - a.bytes) };
}

export function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
