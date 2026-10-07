import type { ExistingLibrary, LibraryPlan, SetupContext } from "@tentacle-tv/shared";

/**
 * Où déposer ses fichiers, à la fin de l'assistant : les dossiers des
 * bibliothèques (celles que l'installation vient de créer, sinon celles qui
 * existaient), dits du point de vue du SERVEUR. Pour le Jellyfin de la pile,
 * son `/media/films` est, sur le serveur, le dossier monté
 * (`TENTACLE_MEDIA_HOST_PATH`) ; ailleurs, le chemin de Jellyfin vaut tel quel.
 */
export interface ContentFolder {
  name: string;
  /** `movies`, `tvshows`, ou `null` (mixte, inconnu). */
  type: string | null;
  /** Le dossier vu par Jellyfin. */
  path: string;
  /** Le même, sur le serveur (pile complète) ; `null` : on ne sait pas mieux que `path`. */
  hostPath: string | null;
}

export function hostPathOf(path: string, context: SetupContext | null): string | null {
  const folders = context?.mediaFolders;
  const host = context?.mediaHostPath?.replace(/\/+$/, "");
  // Un autre Jellyfin que celui de la pile ne voit pas ce dossier ; sans choix connu (fin d'installation), c'est la pile.
  if (!folders || !host || context?.flow.selection?.inStack === false) return null;
  const root = folders.root.replace(/\/+$/, "");
  if (path !== root && !path.startsWith(`${root}/`)) return null;
  return `${host}${path.slice(root.length)}`;
}

/**
 * Rien de connu (une page rechargée oublie ce qui a été créé) : les dossiers
 * que la pile complète prépare pour son Jellyfin, s'il est celui-là.
 */
function stackDefaults(context: SetupContext | null, names: { movies: string; tvshows: string }): Array<{ name: string; type: string; paths: string[] }> {
  const folders = context?.mediaFolders;
  if (!folders || context?.flow.selection?.inStack === false) return [];
  return [
    { name: names.movies, type: "movies", paths: [folders.movies] },
    { name: names.tvshows, type: "tvshows", paths: [folders.tvshows] },
  ];
}

export function contentFolders(input: {
  context: SetupContext | null;
  plans: readonly LibraryPlan[];
  existing: readonly ExistingLibrary[];
  created: ReadonlySet<string>;
  names: { movies: string; tvshows: string };
}): ContentFolder[] {
  const planned = input.plans.filter((plan) => input.created.has(plan.name));
  const known: Array<{ name: string; type: string | null; paths: readonly string[] }> = planned.length ? planned : input.existing.map((library) => ({ ...library }));
  const source = known.length ? known : stackDefaults(input.context, input.names);
  return source.flatMap((library) =>
    library.paths.map((path) => ({ name: library.name, type: library.type, path, hostPath: hostPathOf(path, input.context) })),
  );
}
