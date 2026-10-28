/**
 * Octave — le contrat `music` qu'une EXTENSION déclare dans son manifeste, et
 * les formes de ses réponses : les points d'extension 1 à 5
 * (docs/octave/CONTRATS.md, § Points d'extension).
 *
 * Le cœur ne sait RIEN de ce que l'extension cherche ni d'où elle le tient :
 * il valide la forme, l'affiche, relaie les gestes. Aucune extension active,
 * configurée, déclarant `music` et permise au compte : aucun résultat, aucun
 * bouton, aucune trace — comme `search` et `titles` (pluginSearch.ts, pluginTitles.ts).
 *
 * Toutes les routes sont celles DE l'extension, sous `/api/plugins/<id>`, relayées
 * par le cœur après `requireAuth` (runtime isolé, pluginServerRuntime.ts).
 */

import type { ExternalRef, MusicAlbum, MusicArtist, MusicPlaylistEntry, MusicTrack } from "./musicTypes";
import type { PlaybackSource } from "./musicPlayback";
import type { MusicImportSource } from "./musicImport";
import type { ReleaseSource } from "./musicReleases";

/** Ce que déclare le manifeste (`plugin.json` → `music`), relayé par `/api/plugins/active`. */
export interface PluginMusicManifest {
  /** 1 · Recherche — GET ?q=&limit=&cursor= → `ExternalMusicSearchPage`. */
  search: string;
  /** 2 · Source de lecture — POST `ExternalSourcesRequest` → `ExternalSourcesResponse`. */
  resolve: string;
  /** 2 · Anticipation — POST `MusicPrefetchRequest` → 204. Jamais bloquant. */
  prefetch?: string;
  /** 3 · Cœur — POST { externalId, liked } → `ExternalActionOutcome`. */
  like?: string;
  /**
   * 3 · Playlist — POST { externalId, playlistId, position, duplicate? } → `ExternalActionOutcome`. `duplicate` :
   * l'utilisateur a CONFIRMÉ l'ajout d'un titre déjà présent (un doublon voulu, jamais refusé ni fusionné).
   */
  playlistAdd?: string;
  /**
   * 4 · En attente — GET → `PendingMusicResponse` (les entrées du COMPTE). `DELETE <pending>/<operationId>` → 204 :
   * l'entrée est retirée (« Je n'aime plus », « Retirer de la playlist » d'un titre hors bibliothèque).
   */
  pending?: string;
  /** Écoute menée au bout d'un titre hors bibliothèque — POST { externalId, completed } → 204. */
  played?: string;
  /** Vue album hors bibliothèque — GET <album>/<albumId> → `MusicAlbum` avec `tracks`. */
  album?: string;
  /** Vue artiste hors bibliothèque — GET <artist>/<artistId> → `MusicArtist` avec `topTracks`, `albums`. */
  artist?: string;
  /**
   * Suggestions pendant la frappe — GET ?q=&limit= → `MusicSuggestResponse`. LOCALES : l'extension
   * n'y lit que ses index et ses caches, jamais le réseau ; la recherche complète (`search`) ne part
   * qu'à la validation. Capacité serveur `music.suggest`.
   */
  suggest?: string;
  /** Vue playlist hors bibliothèque — GET <playlist>/<playlistId> → `ExternalMusicPlaylist` avec `tracks`. */
  playlist?: string;
  /**
   * Radio d'un titre — GET <radio>/<externalId> → `ExternalMusicRadio` : ce que la source enchaîne après lui, pour
   * la SUITE d'un clic dans les résultats de recherche (plan de R8, S3), demandée APRÈS le premier son.
   */
  radio?: string;
  /**
   * Pause de frappe — POST { q } → 202, BUREAU seulement (accord de Damien, 25/10) : l'extension PRÉPARE la
   * recherche depuis l'appareil ; rien n'est affiché ni attendu avant la validation.
   */
  typingPause?: string;
  /**
   * Les listes que la recherche sait rendre SEULES (`search?…&kind=<k>` → une page où seule cette liste est
   * remplie) : les puces de filtre en font UNE requête au clic. Absent : l'interface filtre la page « Tout ».
   */
  searchKinds?: MusicSearchKind[];
  /**
   * Droits du COMPTE — GET → `MusicRights` (musicRights.ts) : ajouter à la bibliothèque, limite par jour, garder
   * hors ligne hors bibliothèque. Absent (extension d'avant) : comportement d'avant (`MUSIC_RIGHTS_BEFORE`).
   */
  rights?: string;
  /**
   * Garder hors ligne un titre hors bibliothèque (capacité `offline.music`, bureau et mobile) — GET <offline>/<externalId> → le
   * fichier audio COMPLET (`Content-Length`, `Range` → 206), que l'appareil garde tel quel. Tant qu'il se prépare :
   * 503 (`Retry-After`), le moteur hors ligne réessaie seul ; un titre introuvable ou un droit refusé : 404. Droits
   * tenus par l'extension : session personnelle, `users.rights` → `keepOffline`, et les siens.
   */
  offline?: string;
  /**
   * Ambiances (musicMoods.ts) — GET ?lang= → `ExternalMusicMoods` : la liste des ambiances (clé stable, nom dans la
   * langue `lang` de l'interface, sinon celle du relais ; couleur, mots de recherche). Va avec `mood` ; l'un sans
   * l'autre : aucune ambiance.
   */
  moods?: string;
  /** La playlist d'une ambiance — GET <mood>/<moodId>?lang= → `ExternalMusicMoodMix` (titres de la bibliothèque en tête). */
  mood?: string;
  /** Import (capacité `music.playlistImport`) — POST { url } → `ImportedPlaylist` : lire une source que le cœur ne lit pas. */
  importRead?: string;
  /** Les sources que `importRead` sait lire (liste fermée `MusicImportSource`, sans `text`). */
  importSources?: MusicImportSource[];
  /** Import — POST `ImportTracksRequest` → 202 `ImportTracksAccepted` ; GET/DELETE `<importTracks>/<operationId>`. */
  importTracks?: string;
  /**
   * Sorties importées (lot « sf », musicReleases.ts) — un chemin de BASE : `<releases>/link`, `<releases>/files`,
   * `<releases>/jobs/<id>`, `GET <releases>`. Va avec `releaseSources` ; l'un sans l'autre : aucune entrée « Importer ».
   */
  releases?: string;
  /** Ce que `releases` sait importer (liste fermée `ReleaseSource`). */
  releaseSources?: ReleaseSource[];
  /** Nom de la section de recherche, par langue (« Pas encore dans la bibliothèque »). */
  labels?: Record<string, string>;
}

/** La radio d'un titre : les titres à enchaîner après lui, sans lui — une page. */
export interface ExternalMusicRadio {
  tracks: MusicTrack[];
  /**
   * La page SUIVANTE (radio sans fin) : GET <radio>/<externalId>?cursor=<cursor>. Absent ou `null` : la radio
   * s'arrête là (une extension d'avant n'en donne jamais). Une page suivante peut REDIRE des titres des précédentes
   * (YouTube Music, mesuré le 25/10 : 0 sur 49 dans la même session, 35 sur 49 avec un jeton vieux de deux heures) :
   * la file les écarte.
   */
  cursor?: string | null;
}

/** Liste FERMÉE des listes filtrables d'une recherche. */
export type MusicSearchKind = "tracks" | "albums" | "artists" | "playlists";
export const MUSIC_SEARCH_KINDS: readonly MusicSearchKind[] = ["tracks", "albums", "artists", "playlists"];

/** Une playlist HORS bibliothèque (celle d'une extension) — jamais une playlist Jellyfin (`MusicPlaylist`). */
export interface ExternalMusicPlaylist {
  key: string;
  external: ExternalRef;
  title: string;
  /** Qui l'a composée (une rédaction, une chaîne), si l'extension le sait. */
  owner: string | null;
  trackCount: number | null;
  artworkUrl: string | null;
  /** Rendus par la vue playlist seulement. */
  tracks?: MusicTrack[];
}

/**
 * Le MEILLEUR RÉSULTAT d'une recherche, choisi par l'extension (pertinence ET popularité) : un titre, un album,
 * un artiste ou une playlist ; `tracks` : ce qu'il y a à lire tout de suite depuis sa carte (≤ 3).
 */
export type ExternalMusicTop =
  | { kind: "track"; track: MusicTrack }
  | { kind: "album"; album: MusicAlbum; tracks?: MusicTrack[] }
  | { kind: "artist"; artist: MusicArtist; tracks?: MusicTrack[] }
  | { kind: "playlist"; playlist: ExternalMusicPlaylist };

/** Ce que les clients lisent d'une extension active (forme réduite d'`ActivePluginMeta`). */
export interface MusicCapablePlugin {
  pluginId: string;
  name: string;
  configEnabled?: boolean;
  music?: PluginMusicManifest;
}

/** Une suggestion de la barre : un TEXTE à chercher (la choisir lance `search`, jamais une lecture). */
export interface MusicSuggestion {
  kind: "track" | "artist" | "album";
  title: string;
  /** L'artiste d'un titre ou d'un album ; `null` pour un artiste. */
  subtitle: string | null;
  /** Ce qui part dans la recherche (par défaut : titre et artiste). */
  text: string;
}

export interface MusicSuggestResponse {
  query: string;
  suggestions: MusicSuggestion[];
}

/** 1 · Une page de résultats PROGRESSIVE : `complete` faux → redemander avec `cursor`. */
export interface ExternalMusicSearchPage {
  query: string;
  complete: boolean;
  cursor: string | null;
  tracks: MusicTrack[];
  albums: MusicAlbum[];
  artists: MusicArtist[];
  /**
   * v2 (requête `revise=1`) : la page porte la liste ENTIÈRE, classée, et REMPLACE tout ce qui
   * précède ; absent : elle s'ajoute (première occurrence d'une clé gardée).
   */
  replace?: boolean;
  /** v2 : ce classement peut encore changer — une page suivante le révisera. */
  provisional?: boolean;
  /** Le meilleur résultat (absent : aucune mise en avant ; un client d'avant l'ignore). */
  top?: ExternalMusicTop | null;
  /** Les playlists hors bibliothèque (un client d'avant les ignore). */
  playlists?: ExternalMusicPlaylist[];
}

/**
 * 2 · La demande de sources. `intent` (additif) : `"next"` quand le lecteur
 * PRÉCHARGE le titre suivant de sa file (du fond : l'extension le fait passer
 * après les gestes) ; `"retry"` quand l'utilisateur a demandé « Réessayer » (un
 * geste : l'extension refait tout, sans s'en tenir à un échec qu'elle aurait
 * retenu) ; absent : un geste — un clic —, comme avant. Une extension d'avant
 * l'ignore.
 */
export interface ExternalSourcesRequest {
  ids: string[];
  intent?: "next" | "retry";
}

/** 2 · Une source par identifiant demandé ; absent = pas de source (le client passe au suivant). */
export interface ExternalSourcesResponse {
  sources: { externalId: string; source: PlaybackSource }[];
  /**
   * Des titres demandés n'ont pas de source PARCE QUE le budget de requêtes de
   * l'extension est atteint (pas faute de source) : réessayer dans `afterMs`.
   * Vaut pour les identifiants absents de `sources`. Additif : un client qui
   * l'ignore n'y voit qu'une absence de source, comme avant.
   */
  retry?: SourceRetryHint;
}

export interface SourceRetryHint {
  /** Liste fermée : le client a ses mots pour chacune. */
  reason: "budget";
  afterMs: number;
}

export type PrefetchIntent =
  /** Les premiers résultats d'une recherche. */
  | "results"
  /** Survol ou focus d'un titre. */
  | "hover"
  /** Appui commencé (mousedown / touchstart) : le clic arrive. */
  | "press"
  /** Le titre suivant de la file. */
  | "next";

export interface MusicPrefetchRequest {
  ids: string[];
  intent: PrefetchIntent;
}

/** 3 · Le résultat d'un geste : le cœur affiche l'état tout de suite, la résolution arrive par `music:resolved`. */
export type ExternalActionOutcome =
  | { ok: true; state: "pending" | "library"; operationId: string | null; jellyfinId: string | null }
  | { ok: false; reason: ExternalActionRefusal; message: string | null };

/** Liste FERMÉE : le client a ses mots pour chacune. */
export type ExternalActionRefusal = "quota" | "forbidden" | "unavailable" | "notFound" | "failed";

/** 4 · Une entrée en attente, pour « Titres likés » ou une playlist. */
export interface PendingMusicItem {
  operationId: string;
  externalId: string;
  kind: "like" | "playlistAdd";
  /** Pour `playlistAdd` : la playlist Jellyfin et la position voulue. */
  playlistId: string | null;
  position: number | null;
  track: MusicTrack;
  state: "pending" | "failed";
  createdAt: number;
  /**
   * Ce que l'extension dit de cette entrée, en une phrase courte, dans la langue du compte (« Ne peut pas entrer
   * dans la bibliothèque… ») ; le cœur l'affiche tel quel. Absent : rien à dire.
   */
  note?: string;
  /** Un ajout en playlist d'un titre déjà présent, confirmé : il ne se fond pas dans l'entrée existante. */
  duplicate?: boolean;
  /** Une entrée d'un IMPORT de playlist (`importTracks`) : elle n'attend pas la bibliothèque, sa disponibilité fait foi. */
  imported?: true;
  /**
   * Les identifiants (de la MÊME extension) sous lesquels ce titre a pu être montré avant `externalId` : une entrée
   * importée rapprochée d'une source change d'identité (`imp:<clé>` → `ytm:t:<vidéo>`). Le client y reconnaît ce
   * qu'il tenait sous l'ancienne (une copie gardée sur l'appareil). Absent : aucun.
   */
  formerIds?: string[];
  /** Son rang dans la SOURCE de l'import (`ImportedTrack.index`) : le cœur la montre à sa place d'après lui. */
  sourceIndex?: number;
}

export interface PendingMusicResponse {
  items: PendingMusicItem[];
}

/** Une entrée en attente rendue comme une entrée de playlist (`pending:<operationId>`). */
export function pendingAsPlaylistEntry(item: PendingMusicItem): MusicPlaylistEntry {
  return { entryId: `pending:${item.operationId}`, position: item.position ?? Number.MAX_SAFE_INTEGER, track: item.track };
}

export function externalRefOf(pluginId: string, externalId: string): ExternalRef {
  return { pluginId, id: externalId };
}

/* ── Lecture du manifeste (même garde que `search` et `titles`) ── */

const SAFE_PATH = /^\/[A-Za-z0-9_\-/]{1,100}$/;

function safePath(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_PATH.test(value) && !value.includes("//") ? value : undefined;
}

/** Le contrat `music` d'un manifeste, validé ; `null` si absent ou sans `search` ET `resolve` valides. */
export function readPluginMusicManifest(raw: unknown): PluginMusicManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const search = safePath(m.search);
  const resolve = safePath(m.resolve);
  if (!search || !resolve) return null;
  const out: PluginMusicManifest = { search, resolve };
  for (const key of ["prefetch", "like", "playlistAdd", "pending", "played", "album", "artist", "suggest", "playlist", "radio", "typingPause", "rights", "offline", "moods", "mood", "importRead", "importTracks", "releases"] as const) {
    const path = safePath(m[key]);
    if (path) out[key] = path;
  }
  if (Array.isArray(m.searchKinds)) {
    const kinds = ["tracks", "albums", "artists", "playlists"].filter((k) => (m.searchKinds as unknown[]).includes(k));
    if (kinds.length > 0) out.searchKinds = kinds as NonNullable<PluginMusicManifest["searchKinds"]>;
  }
  if (Array.isArray(m.importSources)) {
    const sources = ["spotify", "apple", "deezer", "youtube"].filter((k) => (m.importSources as unknown[]).includes(k));
    if (sources.length > 0) out.importSources = sources as MusicImportSource[];
  }
  if (Array.isArray(m.releaseSources)) {
    const sources = ["bandcamp", "files"].filter((k) => (m.releaseSources as unknown[]).includes(k));
    if (sources.length > 0) out.releaseSources = sources as NonNullable<PluginMusicManifest["releaseSources"]>;
  }
  if (m.labels && typeof m.labels === "object") {
    const labels: Record<string, string> = {};
    for (const [lang, text] of Object.entries(m.labels as Record<string, unknown>)) {
      if (/^[a-z]{2}$/.test(lang) && typeof text === "string" && text.length <= 60) labels[lang] = text;
    }
    out.labels = labels;
  }
  return out;
}
