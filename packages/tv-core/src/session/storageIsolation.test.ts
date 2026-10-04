import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ACCOUNT_STORAGE_KEYS, PROFILE_STORAGE_KEYS } from "./unpairJournal";
import { SCRUB_COUNTDOWN_KEY_PREFIX } from "../player/scrubCountdownSettings";

/**
 * L'ISOLATION des profils de la Famille (Apple TV), clé par clé : chaque clé
 * de stockage que l'app TV écrit — elle, tv-core et l'api-client qu'elle
 * configure — est CLASSÉE. Une clé de la session part quand on quitte un
 * profil (`PROFILE_STORAGE_KEYS`) ; une clé du jumelage part au déjumelage
 * (`ACCOUNT_STORAGE_KEYS`) ; une clé de l'APPAREIL reste, et ne dit rien d'un
 * compte ; une clé rangée PAR PROFIL porte son identifiant. Une clé nouvelle
 * non classée fait échouer ce test : rien d'un profil ne fuit dans un autre
 * par oubli.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const SOURCES = ["apps/tv/src", "packages/tv-core/src", "packages/api-client/src"];

/** L'appareil : servent dès l'écran de jumelage, communs à tous les profils. */
const DEVICE_KEYS: Record<string, string> = {
  tentacle_server_url: "le serveur de la TV",
  tentacle_language: "la langue de l'interface (le compte la resynchronise)",
  tentacle_device_id: "la graine de l'identité d'appareil",
  tentacle_liquid_glass: "le verre de l'interface",
  tentacle_webos_rail: "la disposition du rail (partagée avec la LG)",
  tentacle_rail_organize_hint: "les passages où « Maintenir OK : organiser » a paru — un apprentissage de l'appareil",
  tentacle_exo_tunneling: "le décodeur d'Android TV",
  tentacle_exo_match_frame_rate: "le décodeur d'Android TV",
  tentacle_unpair_pending: "le marqueur des purges et révocations",
};

/** Rangées par identifiant de profil : chacune n'appartient qu'à lui. */
const PER_PROFILE_PREFIXES = [SCRUB_COUNTDOWN_KEY_PREFIX];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : files(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

function storageKeys(): Map<string, string> {
  const found = new Map<string, string>();
  for (const source of SOURCES) {
    for (const file of files(join(ROOT, source))) {
      for (const match of readFileSync(file, "utf8").matchAll(/["'`](tentacle_[a-z0-9_]+:?)/g)) {
        if (!found.has(match[1])) found.set(match[1], file.slice(ROOT.length + 1));
      }
    }
  }
  return found;
}

describe("l'isolation des profils, clé par clé", () => {
  it("chaque clé de stockage de l'app TV est classée", () => {
    const keys = storageKeys();
    // Le relevé lit bien les sources (un relevé vide passerait toujours).
    expect(keys.has("tentacle_token")).toBe(true);
    expect(keys.has("tentacle_tv_pairing")).toBe(true);
    const unclassified = [...keys].filter(([key]) =>
      !PROFILE_STORAGE_KEYS.includes(key)
      && !ACCOUNT_STORAGE_KEYS.includes(key)
      && !(key in DEVICE_KEYS)
      && !PER_PROFILE_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix)),
    );
    expect(unclassified).toEqual([]);
  });

  it("une clé n'est jamais à la fois de l'appareil et d'un compte", () => {
    for (const key of Object.keys(DEVICE_KEYS)) expect(ACCOUNT_STORAGE_KEYS).not.toContain(key);
  });

  it("la session d'un profil emporte son jeton, son cache, sa file de rapports et sa lecture directe", () => {
    for (const key of ["tentacle_token", "tentacle_user", "tentacle_query_cache_v1", "tentacle_playback_outbox", "tentacle_jellyfin_token", "tentacle_device_id_jf", "tentacle_playback_settings", "tentacle_recent_searches"]) {
      expect(PROFILE_STORAGE_KEYS).toContain(key);
    }
  });
});
