import type { SetupCheck, SetupLibrary, SetupState, SetupTask } from "../jellyfinCompat/setupContract";
import { segmentPlugins } from "./segmentProviders";
import type { Loose, SetupSnapshot } from "./setupSnapshot";

/**
 * Les réglages de Jellyfin qui rendent Tentacle complet, jugés sur l'état lu
 * (`setupSnapshot.ts`) — en logique pure, sans réseau. L'ordre est celui de la
 * page : ce sans quoi un pan de Tentacle manque, puis les conforts, puis
 * l'information.
 */

/** Les pages du tableau de bord de Jellyfin, les mêmes de 10.10 à 12.x (relevé dans jellyfin-web). */
export const DASHBOARD = {
  libraries: "/web/#/dashboard/libraries",
  metadata: "/web/#/dashboard/libraries/metadata",
  transcoding: "/web/#/dashboard/playback/transcoding",
  plugins: "/web/#/dashboard/plugins",
} as const;

/** Les tâches planifiées que déclenchent des gestes de la page. */
export const TASK_KEYS = { trickplay: "RefreshTrickplayImages", segments: "TaskExtractMediaSegments" } as const;

const isRecord = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * Films, séries, et la bibliothèque mixte — celle que Jellyfin range sans type
 * (cf. `routes/jellyfinProxy/libraryViews.ts`). Rien d'autre ne s'affiche dans
 * Tentacle : musique ou livres n'ont rien à régler ici.
 */
export function isVideoLibrary(library: Loose): boolean {
  const type = text(library.CollectionType).toLowerCase();
  return type === "" || type === "movies" || type === "tvshows" || type === "mixed";
}

const optionsOf = (library: Loose): Loose => (isRecord(library.LibraryOptions) ? library.LibraryOptions : {});

function flagged(libraries: readonly Loose[], read: (options: Loose, library: Loose) => boolean): SetupLibrary[] {
  return libraries.map((library) => ({
    id: text(library.ItemId),
    name: text(library.Name) || text(library.ItemId),
    enabled: read(optionsOf(library), library),
  }));
}

/** Tout activé : fait ; rien à juger (aucune bibliothèque, ou lecture ratée) : inconnu. */
function allEnabled(libraries: SetupLibrary[] | null): SetupState {
  if (!libraries || libraries.length === 0) return "unknown";
  return libraries.every((library) => library.enabled) ? "done" : "todo";
}

export function readTask(tasks: readonly Loose[] | null, key: string): SetupTask | null {
  const task = tasks?.find((candidate) => candidate.Key === key);
  if (!task) return null;
  const last = isRecord(task.LastExecutionResult) ? task.LastExecutionResult : null;
  const running = text(task.State).toLowerCase() === "running";
  return {
    state: running ? "running" : "idle",
    progress: running && typeof task.CurrentProgressPercentage === "number" ? Math.round(task.CurrentProgressPercentage) : null,
    lastRunAt: last && text(last.EndTimeUtc) ? text(last.EndTimeUtc) : null,
    lastStatus: last && text(last.Status) ? text(last.Status) : null,
  };
}

const base = { libraries: null, current: null, missingTmdb: null, plugins: null, task: null, action: null } as const;

/**
 * TMDB : l'identifiant dont vivent les recommandations, les sagas, Vigie et la
 * recherche hors bibliothèque. Le greffon TMDb est intégré à Jellyfin ; une
 * bibliothèque peut pourtant l'écarter de ses fournisseurs (`TypeOptions`).
 */
function tmdbCheck(snapshot: SetupSnapshot, videos: Loose[] | null): SetupCheck {
  const plugin = snapshot.plugins?.find((p) => /^tmdb$/i.test(text(p.Name)) || text(p.Id).toLowerCase() === "b8715ed16c4745289ad3f72deb539cd4");
  const pluginActive = plugin ? text(plugin.Status).toLowerCase() === "active" : null;
  const libraries = videos && flagged(videos, (options, library) => {
    const types = text(library.CollectionType).toLowerCase() === "tvshows" ? ["Series"]
      : text(library.CollectionType).toLowerCase() === "movies" ? ["Movie"] : ["Movie", "Series"];
    const typeOptions = Array.isArray(options.TypeOptions) ? options.TypeOptions.filter(isRecord) : [];
    // Sans entrée pour un type, Jellyfin prend tous ses fournisseurs : TMDB compris.
    return types.every((type) => {
      const entry = typeOptions.find((candidate) => candidate.Type === type);
      return !entry || !Array.isArray(entry.MetadataFetchers) || entry.MetadataFetchers.includes("TheMovieDb");
    });
  });
  const librariesState = allEnabled(libraries);
  const state: SetupState = pluginActive === false ? "todo"
    : pluginActive === null || librariesState === "unknown" ? "unknown" : librariesState;
  return {
    ...base,
    id: "metadataTmdb",
    level: "essential",
    state,
    libraries,
    missingTmdb: snapshot.missingTmdb,
    dashboardPath: pluginActive === false ? DASHBOARD.plugins : DASHBOARD.libraries,
  };
}

function languageCheck(snapshot: SetupSnapshot): SetupCheck {
  const language = text(snapshot.config?.PreferredMetadataLanguage);
  const country = text(snapshot.config?.MetadataCountryCode);
  const state: SetupState = !snapshot.config ? "unknown" : language && country ? "done" : "todo";
  return {
    ...base,
    id: "metadataLanguage",
    level: "recommended",
    state,
    current: language || country ? [language, country].filter(Boolean).join(" · ") : null,
    action: state === "todo" ? "setMetadataLanguage" : null,
    dashboardPath: DASHBOARD.metadata,
  };
}

function libraryFlagCheck(
  id: "trickplay" | "realtimeMonitor",
  key: string,
  videos: Loose[] | null,
  task: SetupTask | null,
): SetupCheck {
  const libraries = videos && flagged(videos, (options) => options[key] === true);
  const state = allEnabled(libraries);
  const enable = id === "trickplay" ? "enableTrickplay" : "enableRealtimeMonitor";
  // Réglé, la génération peut être lancée tout de suite plutôt qu'à la prochaine nuit.
  const followUp = id === "trickplay" && state === "done" && task?.state === "idle" ? "generateTrickplay" : null;
  return {
    ...base,
    id,
    level: "recommended",
    state,
    libraries,
    task,
    action: state === "todo" ? enable : followUp,
    dashboardPath: DASHBOARD.libraries,
  };
}

function segmentsCheck(snapshot: SetupSnapshot): SetupCheck {
  const plugins = snapshot.plugins ? segmentPlugins(snapshot.plugins) : null;
  const state: SetupState = !plugins ? "unknown"
    : plugins.some((p) => p.state === "active") ? "done"
    : plugins.some((p) => p.state === "restart") ? "pending-restart" : "todo";
  const officialMissing = plugins?.some((p) => p.official && p.state === "missing") ?? false;
  const task = readTask(snapshot.tasks, TASK_KEYS.segments);
  return {
    ...base,
    id: "segmentsProvider",
    level: "recommended",
    state,
    plugins,
    task,
    action: state === "todo" && officialMissing ? "installChapterSegments"
      : state === "done" && task?.state === "idle" ? "scanMediaSegments" : null,
    dashboardPath: DASHBOARD.plugins,
  };
}

function hardwareCheck(snapshot: SetupSnapshot): SetupCheck {
  const type = text(snapshot.encoding?.HardwareAccelerationType);
  const state: SetupState = !snapshot.encoding ? "unknown" : type && type.toLowerCase() !== "none" ? "done" : "todo";
  return { ...base, id: "hardwareAcceleration", level: "optional", state, current: type || null, dashboardPath: DASHBOARD.transcoding };
}

/** Tentacle n'affiche pas les images de chapitres : les générer coûte au serveur sans rien apporter ici. */
function chapterImagesCheck(videos: Loose[] | null): SetupCheck {
  return {
    ...base,
    id: "chapterImages",
    level: "optional",
    state: "not-needed",
    libraries: videos && flagged(videos, (options) => options.EnableChapterImageExtraction === true),
    dashboardPath: DASHBOARD.libraries,
  };
}

export function evaluateSetup(snapshot: SetupSnapshot): SetupCheck[] {
  const videos = snapshot.libraries ? snapshot.libraries.filter(isVideoLibrary) : null;
  return [
    tmdbCheck(snapshot, videos),
    languageCheck(snapshot),
    libraryFlagCheck("trickplay", "EnableTrickplayImageExtraction", videos, readTask(snapshot.tasks, TASK_KEYS.trickplay)),
    segmentsCheck(snapshot),
    libraryFlagCheck("realtimeMonitor", "EnableRealtimeMonitor", videos, null),
    hardwareCheck(snapshot),
    chapterImagesCheck(videos),
  ];
}
