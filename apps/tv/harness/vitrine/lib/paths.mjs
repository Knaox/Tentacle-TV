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

/** Les séries des autres stores, chacune dans un dossier DATÉ à côté de
 *  l'actuelle (jamais par-dessus). Microsoft n'avait pas de dossier. */
const STORES_ROOT = process.env.VITRINE_STORES ?? path.join(PROJECTS, "Tentacle-AppStore");
export const STORE_OUT = {
  iphone: path.join(STORES_ROOT, "IOS/2026-10"),
  ipad: path.join(STORES_ROOT, "Ipad/2026-10"),
  ipadLandscape: path.join(STORES_ROOT, "Ipad/2026-10-paysage"),
  mac: path.join(STORES_ROOT, "macos/2026-10"),
  playPhone: path.join(STORES_ROOT, "PlayStore/2026-10/telephone"),
  playTablet: path.join(STORES_ROOT, "PlayStore/2026-10/tablette"),
  playBrand: path.join(STORES_ROOT, "PlayStore/2026-10"),
  microsoft: path.join(STORES_ROOT, "microsoft/2026-10"),
};
/** Les captures brutes du client web, par appareil et par langue. */
export const WEB_CAPTURES = path.join(HOME, "captures-web");

/** Le client WEB capturé pour le téléphone, la tablette et le bureau : le code
 *  de `main` (ce qui est livré), dans un worktree à lui — jamais la branche de
 *  la vitrine, qui porte la refonte TV et ses paquets partagés modifiés. */
export const WEB_ROOT = process.env.VITRINE_WEB_ROOT ?? path.join(PROJECTS, ".claude/worktrees/vitrine-web");

/** Le banc de la vitrine : un simulateur et des ports à elle, jamais ceux
 *  d'une autre session (RCT_jsLocation relus avant de les choisir). */
export const BENCH = {
  simName: process.env.VITRINE_SIM_NAME ?? "Banc UI TV — vitrine (Claude)",
  relayPort: Number(process.env.VITRINE_RELAY_PORT ?? 8613),
  metroPort: Number(process.env.VITRINE_METRO_PORT ?? 8614),
};
