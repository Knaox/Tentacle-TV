import { isNewerVersion } from "./semver";

/**
 * Quelle version d'une extension CE serveur peut prendre.
 *
 * Un registre liste les versions publiées (`versions[]`), chacune avec la
 * version de Tentacle qu'elle exige (`minTentacleVersion`). Les serveurs
 * jusqu'à 1.24 n'en tiennent aucun compte : ils prennent la version annoncée
 * (`latestVersion`). Le registre garde donc `latestVersion` sur ce que TOUT
 * serveur peut prendre, et un serveur d'aujourd'hui choisit lui-même la plus
 * récente qui lui convient : une extension qui exige 1.25 n'atteint jamais un
 * 1.24, et un 1.25 la trouve quand même.
 *
 * Une version sans exigence vaut « compatible ».
 */

export interface VersionRequirement {
  version: string;
  minTentacleVersion?: string;
}

export function isCompatibleWith(serverVersion: string, required: string | undefined): boolean {
  return !required || !isNewerVersion(required, serverVersion);
}

export interface VersionPick<V extends VersionRequirement> {
  /** La plus récente que ce serveur peut prendre ; `undefined` : aucune. */
  chosen: V | undefined;
  /** La plus récente publiée, quand elle exige un serveur plus récent que celui-ci. */
  tooNew: V | undefined;
}

function newest<V extends VersionRequirement>(versions: readonly V[]): V | undefined {
  return versions.reduce<V | undefined>((best, v) => (!best || isNewerVersion(v.version, best.version) ? v : best), undefined);
}

export function pickVersion<V extends VersionRequirement>(versions: readonly V[], serverVersion: string): VersionPick<V> {
  const chosen = newest(versions.filter((v) => isCompatibleWith(serverVersion, v.minTentacleVersion)));
  const latest = newest(versions);
  const tooNew = latest && latest !== chosen && !isCompatibleWith(serverVersion, latest.minTentacleVersion) ? latest : undefined;
  return { chosen, tooNew };
}

/** Le refus d'une version trop récente, tel que l'administration le reconnaît. */
export function requiresNewerServer(minTentacleVersion: string) {
  return {
    code: "plugin_requires_newer_server",
    required: minTentacleVersion,
    message: `This plugin version requires a newer Tentacle server (${minTentacleVersion} or later)`,
  };
}
