import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ACCOUNT_STORAGE_KEYS, PROFILE_STORAGE_KEYS } from "./unpairJournal";
import { SCRUB_COUNTDOWN_KEY_PREFIX } from "../player/scrubCountdownSettings";
import { TRAILER_SUBTITLE_KEY_PREFIX } from "../player/trailerSubtitleMemory";
import { RAIL_LIBRARIES_STORAGE_KEY, RAIL_PROFILES_STORAGE_KEY } from "../nav/railProfiles";
import { PIN_SETUP_STORAGE_KEY } from "./pinSetup";

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
  tentacle_tv_card_size: "la taille des cartes (un réglage de l'écran du salon)",
  tentacle_webos_rail: "la disposition du rail (partagée avec la LG)",
  tentacle_rail_organize_hint: "les passages où « Maintenir OK : organiser » a paru — un apprentissage de l'appareil",
  tentacle_exo_tunneling: "le décodeur d'Android TV",
  tentacle_exo_match_frame_rate: "le décodeur d'Android TV",
  tentacle_tv_trailer_previews: "les aperçus de bande-annonce au focus (réglage du téléviseur, comme le bureau)",
  tentacle_tv_trailer_preview_sound: "le son de ces aperçus",
  tentacle_tv_trailer_preview_delay: "leur délai avant la première image (réglage du téléviseur)",
  tentacle_tv_boot_sound: "le ta-dum de l'ouverture du démarrage (réglage du téléviseur, avant tout profil)",
  tentacle_unpair_pending: "le marqueur des purges et révocations",
};

/** Rangées par identifiant de profil : chacune n'appartient qu'à lui. */
const PER_PROFILE_PREFIXES = [SCRUB_COUNTDOWN_KEY_PREFIX, TRAILER_SUBTITLE_KEY_PREFIX];

/** Une seule clé, mais un objet rangé par identifiant de profil : chaque identité n'y lit que SON entrée. */
const PER_PROFILE_MAPS: Record<string, string> = {
  [RAIL_PROFILES_STORAGE_KEY]: "la disposition du rail de chaque profil sur cette TV (préconfiguration comprise)",
  [RAIL_LIBRARIES_STORAGE_KEY]: "le dernier nombre de bibliothèques vu par chaque profil (la page de préconfiguration ou l'accueil)",
  [PIN_SETUP_STORAGE_KEY]: "les profils à qui l'étape « Code PIN conseillé » a été proposée sur cette TV",
  tentacle_prompts_reset_seen: "la dernière demande « Reproposer le code PIN et la photo » honorée pour chaque profil sur cette TV",
  tentacle_avatar_invite_seen: "les sujets à qui la galerie des avatars a été proposée sur cette TV (la clé du bureau et du mobile)",
};

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
      && !(key in PER_PROFILE_MAPS)
      && !PER_PROFILE_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix)),
    );
    expect(unclassified).toEqual([]);
  });

  it("une clé n'est jamais à la fois de l'appareil et d'un compte", () => {
    for (const key of Object.keys(DEVICE_KEYS)) expect(ACCOUNT_STORAGE_KEYS).not.toContain(key);
  });

  it("quitter un profil n'efface pas les dispositions du rail de toute la famille", () => {
    for (const key of Object.keys(PER_PROFILE_MAPS)) expect(PROFILE_STORAGE_KEYS).not.toContain(key);
  });

  it("la session d'un profil emporte son jeton, son cache, sa file de rapports et sa lecture directe", () => {
    for (const key of ["tentacle_token", "tentacle_user", "tentacle_query_cache_v1", "tentacle_playback_outbox", "tentacle_jellyfin_token", "tentacle_device_id_jf", "tentacle_playback_settings", "tentacle_still_watching", "tentacle_recent_searches"]) {
      expect(PROFILE_STORAGE_KEYS).toContain(key);
    }
  });
});
