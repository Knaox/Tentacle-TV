import type { SetupPlugin, SetupPluginState } from "../jellyfinCompat/setupContract";
import { normalizeGuid, SEGMENT_PLUGIN_SPECS } from "../segmentPlugins/catalog";
import type { Loose } from "./setupSnapshot";

/**
 * Les greffons Jellyfin qui fournissent des passages (Media Segments) : c'est
 * d'eux que viennent « Passer l'intro », « Passer le générique » et l'épisode
 * suivant au bon moment. Ils s'EMPILENT — chacun signale ce qu'il sait, le
 * résolveur de Tentacle prend le plus précis.
 *
 * Depuis le 2026-10-06, Tentacle les installe lui-même (assistant, ou
 * « Installer / réparer » de l'administration — `services/segmentPlugins/`) :
 * Intro Skipper, TheIntroDB et SkipMe.db, les trois attendus. « Chapter
 * Segments » n'est plus proposé (il n'apporte rien de plus) ; son geste reste
 * pour les clients livrés qui l'envoient encore.
 */

export const CHAPTER_SEGMENTS = {
  /** Nom du paquet au catalogue officiel (`/Packages`) et son identifiant d'assemblage. */
  packageName: "Chapter Segments Provider",
  assemblyGuid: "698b6f3314ca49b59d79fc3c0ab941f5",
};

/** « Active », « Restart », « Disabled »… tels que `/Plugins` les rend. */
function pluginState(status: unknown): SetupPluginState {
  switch (typeof status === "string" ? status.toLowerCase() : "") {
    case "active":
      return "active";
    case "restart":
      return "restart";
    case "":
      return "missing";
    default:
      // Disabled, NotSupported, Malfunctioned, Superceded, Deleted : rien ne tourne.
      return "disabled";
  }
}

/** Chaque greffon attendu, et où il en est sur ce serveur (reconnu par son identifiant, à défaut son nom). */
export function segmentPlugins(installed: readonly Loose[]): SetupPlugin[] {
  return SEGMENT_PLUGIN_SPECS.map((spec) => {
    const found = installed.find((plugin) => normalizeGuid(plugin.Id) === spec.guid)
      ?? installed.find((plugin) => typeof plugin.Name === "string" && plugin.Name.toLowerCase() === spec.packageName.toLowerCase());
    return {
      name: spec.packageName,
      state: found ? pluginState(found.Status) : "missing",
      official: false,
      homepage: spec.homepage,
      repositoryUrl: spec.repository.url,
    };
  });
}
