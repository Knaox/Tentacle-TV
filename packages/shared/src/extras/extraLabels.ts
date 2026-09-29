import type { TFunction } from "i18next";

/**
 * Ce qu'est un extra, et comment l'appeler — une seule lecture pour les
 * tuiles du web, du miroir, du mobile et des téléviseurs.
 *
 * Deux sources le disent : Jellyfin, dans `ExtraType` (« BehindTheScenes »,
 * « DeletedScene »…), pour un extra LOCAL ; TMDB, dans `type` (« Trailer »,
 * « Teaser », « Behind the Scenes »…), pour une vidéo distante. Les tuiles
 * montraient le `Type` brut de l'item (« Video ») : de l'anglais, et rien sur
 * ce qu'on allait voir.
 */
export type ExtraKind =
  | "trailer"
  | "teaser"
  | "behindTheScenes"
  | "deletedScene"
  | "featurette"
  | "interview"
  | "scene"
  | "short"
  | "clip"
  | "sample"
  | "themeSong"
  | "themeVideo"
  | "bloopers"
  | "extra";

/** Les graphies connues, repliées (minuscules, sans espace ni tiret). */
const SPELLINGS: Record<string, ExtraKind> = {
  trailer: "trailer",
  trailers: "trailer",
  teaser: "teaser",
  teasers: "teaser",
  behindthescenes: "behindTheScenes",
  deleted: "deletedScene",
  deletedscene: "deletedScene",
  deletedscenes: "deletedScene",
  featurette: "featurette",
  featurettes: "featurette",
  interview: "interview",
  interviews: "interview",
  scene: "scene",
  scenes: "scene",
  short: "short",
  shorts: "short",
  clip: "clip",
  clips: "clip",
  sample: "sample",
  samples: "sample",
  themesong: "themeSong",
  themevideo: "themeVideo",
  blooper: "bloopers",
  bloopers: "bloopers",
  extra: "extra",
  extras: "extra",
};

const LABEL_KEYS: Record<ExtraKind, string> = {
  trailer: "common:extraKindTrailer",
  teaser: "common:extraKindTeaser",
  behindTheScenes: "common:extraKindBehindTheScenes",
  deletedScene: "common:extraKindDeletedScene",
  featurette: "common:extraKindFeaturette",
  interview: "common:extraKindInterview",
  scene: "common:extraKindScene",
  short: "common:extraKindShort",
  clip: "common:extraKindClip",
  sample: "common:extraKindSample",
  themeSong: "common:extraKindThemeSong",
  themeVideo: "common:extraKindThemeVideo",
  bloopers: "common:extraKindBloopers",
  extra: "common:extraKindExtra",
};

const fold = (raw: string) => raw.toLowerCase().replace(/[\s_-]+/g, "");

/** Le genre nommé par `raw`, ou `null` s'il n'en nomme aucun. */
function knownKind(raw: string): ExtraKind | null {
  return SPELLINGS[fold(raw)] ?? null;
}

/** Le genre d'un extra d'après Jellyfin (`ExtraType`) ou TMDB (`type`) ; `extra` à défaut. */
export function extraKind(raw: string | null | undefined): ExtraKind {
  return (raw && knownKind(raw)) || "extra";
}

/** Le genre d'un extra LOCAL : `ExtraType`, sinon son `Type` — une bande-annonce reste `Trailer`. */
export function localExtraKind(extra: { ExtraType?: string; Type?: string }): ExtraKind {
  const fromExtraType = extra.ExtraType ? knownKind(extra.ExtraType) : null;
  return fromExtraType ?? (extra.Type === "Trailer" ? "trailer" : "extra");
}

export function extraKindLabel(t: TFunction, kind: ExtraKind): string {
  return t(LABEL_KEYS[kind]);
}

/** « Trailer 2 », « Behind The Scenes » : un genre, numéroté quand il se répète. */
const GENERIC_NAME = /^(.+?)(?:\s+(\d+))?$/;

/**
 * Le suffixe de fichier d'un extra, tel que Jellyfin 10.x le laissait dans son
 * nom (« The Matrix (1999)-trailer », « Teaser-trailer »). Séparateur `-`, `.`
 * ou `_` seulement : un vrai titre qui finit par « Scene » ou « Short » garde
 * ce mot.
 */
const FILE_SUFFIX =
  /^(.*?)[-._](trailer|teaser|behindthescenes|deleted|deletedscene|featurette|interview|scene|short|clip|sample|other|extra)$/i;

/** Ce qui reste d'un nom de fichier suffixé : le nom du film lui-même, année comprise. */
const OWNER_FILE_NAME = /\(\d{4}\)$/;

/**
 * Le titre d'un extra local.
 *
 * Depuis Jellyfin 12 (#17456), un extra sans titre à lui porte le nom de son
 * GENRE, en anglais — « Trailer », « Behind The Scenes », numéroté quand le
 * genre se répète (« Trailer 2 ») ; avant, celui de son fichier, suffixe
 * compris (« The Matrix (1999)-trailer »). Ces noms-là se traduisent ; un vrai
 * titre (« Making Of », « Dream Architecture ») reste tel quel.
 */
export function localExtraTitle(t: TFunction, extra: { Name?: string; ExtraType?: string; Type?: string }): string {
  const own = extraKindLabel(t, localExtraKind(extra));
  const name = (extra.Name ?? "").trim();
  if (name === "") return own;

  const generic = GENERIC_NAME.exec(name);
  const genericKind = generic ? knownKind(generic[1]) : null;
  if (generic && genericKind) {
    const label = extraKindLabel(t, genericKind);
    return generic[2] ? t("common:extraNumbered", { kind: label, number: generic[2] }) : label;
  }

  const suffixed = FILE_SUFFIX.exec(name);
  if (!suffixed) return name;
  const rest = suffixed[1].trim();
  return rest === "" || OWNER_FILE_NAME.test(rest) ? own : rest;
}
