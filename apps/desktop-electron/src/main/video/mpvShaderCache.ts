/**
 * Le cache de nuanceurs de mpv — mort sous libmpv, rallumé ici.
 *
 * # Pourquoi il est mort
 *
 * `--gpu-shader-cache` vaut `yes` par défaut, et sur Vulkan comme sur D3D11 il
 * évite de recompiler à chaque lecture les nuanceurs de libplacebo (GLSL →
 * SPIR-V par glslang, puis les pipelines du pilote). Mais le profil intégré
 * `[libmpv]` pose `config=no` (`etc/builtin.conf` de mpv 0.41), et avec lui
 * `mp_get_platform_path` rend NULL pour TOUT chemin de plateforme — « cache »
 * compris (`options/path.c`) : `cache_init` de `vo_gpu_next.c` sort alors sans
 * rien ouvrir, en silence. Le manuel promet `~/.cache/mpv` ; un client libmpv
 * n'y écrit jamais.
 *
 * Seul `--gpu-shader-cache-dir`, explicite, passe outre : c'est un chemin de
 * la coquille, comme le journal (`mpvLogFile.ts`) — la page ne choisit pas de
 * dossier, et l'option n'est pas dans sa liste blanche. mpv crée le dossier
 * lui-même (`mp_mkdirp`) et borne le cache à 128 Mio.
 */

import path from "node:path";
import type { MpvValue } from "./mpvAllowlist";

/** Le sous-dossier du cache, sous le dossier de données de l'application. */
export const SHADER_CACHE_FOLDER = "mpv-shader-cache";

/** Les deux options qui rallument le cache, pour le dossier donné. */
export function shaderCacheOptions(userData: string): Record<string, MpvValue> {
  return {
    "gpu-shader-cache": "yes",
    "gpu-shader-cache-dir": path.join(userData, SHADER_CACHE_FOLDER),
  };
}

/** Les options de la page, cache de nuanceurs compris. Pure. */
export function withShaderCache(
  options: Readonly<Record<string, MpvValue>>,
  userData: string,
): Record<string, MpvValue> {
  return { ...options, ...shaderCacheOptions(userData) };
}
