import {
  SERVER_IMAGE_REPOSITORY,
  parseServerVersion,
  type ServerInstall,
  type ServerRelease,
  type ServerUpdateCheckError,
  type ServerUpdateReport,
} from "@tentacle-tv/shared";

/**
 * La réponse de `/api/admin/server-update`, lue champ par champ : le bureau
 * embarque le tableau de bord et parle à des serveurs de toutes versions — un
 * champ manquant vaut « inconnu », il ne fait pas tomber la carte. Module pur,
 * sans `fetch` : il se teste sans monter l'application.
 */

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const texts = (value: unknown): string[] => (Array.isArray(value) ? value.filter((t): t is string => typeof t === "string" && t.trim() !== "") : []);
const CHECK_ERRORS: readonly ServerUpdateCheckError[] = ["unreachable", "rate-limited", "invalid", "off"];

function readRelease(raw: unknown): ServerRelease | null {
  if (!isRecord(raw) || typeof raw.version !== "string" || !parseServerVersion(raw.version)) return null;
  const highlights = isRecord(raw.highlights) ? raw.highlights : {};
  return {
    version: raw.version,
    tag: typeof raw.tag === "string" ? raw.tag : `server-v${raw.version}`,
    publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : null,
    // Un lien qui ne mène pas aux publications de GitHub n'est pas montré.
    url: typeof raw.url === "string" && raw.url.startsWith("https://github.com/") ? raw.url : "",
    highlights: { fr: texts(highlights.fr), en: texts(highlights.en) },
  };
}

function readInstall(raw: unknown): ServerInstall {
  const install = isRecord(raw) ? raw : {};
  const runtime = install.runtime === "docker" || install.runtime === "podman" ? install.runtime : "none";
  return {
    runtime,
    repository: typeof install.repository === "string" && install.repository ? install.repository : SERVER_IMAGE_REPOSITORY,
    tag: typeof install.tag === "string" && install.tag ? install.tag : null,
  };
}

export function readServerUpdateReport(raw: unknown): ServerUpdateReport | null {
  if (!isRecord(raw) || typeof raw.current !== "string" || raw.current === "") return null;
  const error = CHECK_ERRORS.find((known) => known === raw.error) ?? null;
  return {
    current: raw.current,
    bootId: typeof raw.bootId === "string" ? raw.bootId : "",
    latest: readRelease(raw.latest),
    behind: typeof raw.behind === "number" && Number.isFinite(raw.behind) && raw.behind > 0 ? Math.floor(raw.behind) : 0,
    requiredByClients: parseServerVersion(raw.requiredByClients) ? (raw.requiredByClients as string) : null,
    checkedAt: typeof raw.checkedAt === "string" ? raw.checkedAt : null,
    error,
    install: readInstall(raw.install),
  };
}
