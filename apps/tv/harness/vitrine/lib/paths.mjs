// Les dossiers de la vitrine. Les binaires (images libres, instantané,
// captures, visuels) vivent HORS du dépôt : seuls les scripts, le catalogue
// et les accroches sont versionnés.
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIB = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(LIB, "..");
export const APP_DIR = path.resolve(ROOT, "../..");
export const REPO = path.resolve(APP_DIR, "../..");
export const BENCH_DIR = path.join(APP_DIR, "harness/ui-bench");
export const CATALOG = path.join(ROOT, "catalog");
export const FONTS = path.join(APP_DIR, "assets/fonts");
export const BRAND = path.join(REPO, "brand");

const PROJECTS = process.env.VITRINE_PROJECTS ?? path.join(os.homedir(), "Desktop/Projet - local");

export const HOME = process.env.VITRINE_HOME ?? path.join(PROJECTS, "Tentacle-Vitrine");
export const SOURCES = path.join(HOME, "sources");
export const SNAPSHOT = path.join(HOME, "snapshot");
export const CAPTURES = path.join(HOME, "captures");
export const SITE_OUT = path.join(HOME, "site");
export const SHEETS = path.join(HOME, "planches");
// La série App Store vit À CÔTÉ de l'actuelle, jamais par-dessus.
export const APPSTORE_OUT = process.env.VITRINE_APPSTORE ?? path.join(PROJECTS, "Tentacle-AppStore/appletv/2026-10-refonte");

export const LANGS = ["fr", "en"];

/** Le banc de la vitrine : un simulateur et des ports à elle, jamais ceux
 *  d'une autre session (RCT_jsLocation relus avant de les choisir). */
export const BENCH = {
  simName: process.env.VITRINE_SIM_NAME ?? "Banc UI TV — vitrine (Claude)",
  relayPort: Number(process.env.VITRINE_RELAY_PORT ?? 8613),
  metroPort: Number(process.env.VITRINE_METRO_PORT ?? 8614),
};
