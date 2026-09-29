import type { SetupPlugin, SetupPluginState } from "../jellyfinCompat/setupContract";
import type { Loose } from "./setupSnapshot";

/**
 * Les greffons Jellyfin qui fournissent des passages (Media Segments) : c'est
 * d'eux que viennent « Passer l'intro », « Passer le générique » et l'épisode
 * suivant au bon moment. Ils s'EMPILENT — chacun signale ce qu'il sait, le
 * résolveur de Tentacle prend le plus précis — et Tentacle analyse déjà la fin
 * des médias à la première lecture (`services/tailAnalysis`).
 *
 * Un seul est au dépôt OFFICIEL de Jellyfin, donc installable en un clic ; les
 * autres demandent d'ajouter leur dépôt (un choix de confiance qui revient à
 * l'administrateur) ou de poser leur DLL à la main.
 */

export interface SegmentProvider {
  name: string;
  match: RegExp;
  official: boolean;
  homepage: string;
  repositoryUrl: string | null;
}

export const CHAPTER_SEGMENTS = {
  /** Nom du paquet au catalogue officiel (`/Packages`) et son identifiant d'assemblage. */
  packageName: "Chapter Segments Provider",
  assemblyGuid: "698b6f3314ca49b59d79fc3c0ab941f5",
};

export const SEGMENT_PROVIDERS: readonly SegmentProvider[] = [
  {
    name: "Intro Skipper",
    match: /intro\s*skipper/i,
    official: false,
    homepage: "https://github.com/intro-skipper/intro-skipper",
    // « All Jellyfin Versions » d'après le projet : le manifeste s'adapte à la version qui le lit.
    repositoryUrl: "https://intro-skipper.org/manifest.json",
  },
  {
    name: CHAPTER_SEGMENTS.packageName,
    match: /chapter\s*segments/i,
    official: true,
    homepage: "https://github.com/jellyfin/jellyfin-plugin-chapter-segments",
    repositoryUrl: null,
  },
  {
    name: "TheIntroDB",
    match: /introdb/i,
    official: false,
    homepage: "https://github.com/TheIntroDB/jellyfin-plugin",
    repositoryUrl: "https://raw.githubusercontent.com/TheIntroDB/jellyfin-plugin/main/manifest.json",
  },
  {
    name: "SkipMe.db",
    match: /skipme/i,
    official: false,
    homepage: "https://github.com/intro-skipper/skipme.db-plugin",
    // Pas de dépôt : une DLL à poser à la main (Jellyfin 12 seulement).
    repositoryUrl: null,
  },
];

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

/** Chaque fournisseur connu, et où il en est sur ce serveur. */
export function segmentPlugins(installed: readonly Loose[]): SetupPlugin[] {
  return SEGMENT_PROVIDERS.map((provider) => {
    const found = installed.find((plugin) => typeof plugin.Name === "string" && provider.match.test(plugin.Name));
    return {
      name: provider.name,
      state: found ? pluginState(found.Status) : "missing",
      official: provider.official,
      homepage: provider.homepage,
      repositoryUrl: provider.repositoryUrl,
    };
  });
}
