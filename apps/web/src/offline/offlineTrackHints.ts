/**
 * Application HORS LIGNE des préférences de pistes : une fois le fichier local
 * chargé par mpv, on lit sa track-list (pistes internes + side-cars ajoutés
 * par le lecteur) via les SOUS-PROPRIÉTÉS (`track-list/N/...` — formats
 * simples portables sur les 3 adaptateurs) et on pilote `aid`/`sid`
 * directement — fiable après chargement, sans toucher à l'initialisation du
 * lecteur ni aux index Jellyfin (indisponibles sans serveur).
 */

import { getMpvApi, loadMpvApi, type PluginApi } from "../hooks/mpvRuntime";
import { prefForLibrary, sameLang, type CachedLibraryPref } from "./localTrackPrefs";

interface MpvTrack {
  id?: number;
  type?: string;
  lang?: string | null;
  forced?: boolean;
}

async function readTrack(api: PluginApi, index: number): Promise<MpvTrack> {
  const at = (suffix: string, format: "string" | "int64" | "flag"): Promise<unknown> =>
    api.getProperty(`track-list/${index}/${suffix}`, format).catch(() => null);
  const [type, lang, id, forced] = await Promise.all([
    at("type", "string"),
    at("lang", "string"),
    at("id", "int64"),
    at("forced", "flag"),
  ]);
  return {
    type: typeof type === "string" ? type : undefined,
    lang: typeof lang === "string" ? lang : null,
    id: typeof id === "number" ? id : undefined,
    forced: forced === true || forced === "yes",
  };
}

async function readTrackList(api: PluginApi): Promise<MpvTrack[]> {
  const rawCount = (await api
    .getProperty("track-list/count", "int64")
    .catch(() => null)) as unknown;
  const count =
    typeof rawCount === "number" ? rawCount : Number.parseInt(String(rawCount ?? ""), 10);
  if (!Number.isInteger(count) || count <= 0 || count > 200) return [];
  return Promise.all(Array.from({ length: count }, (_, index) => readTrack(api, index)));
}

function pickAudio(tracks: MpvTrack[], pref: CachedLibraryPref): number | null {
  if (!pref.audioLang) return null;
  const audio = tracks.filter((t) => t.type === "audio" && typeof t.id === "number");
  return audio.find((t) => sameLang(t.lang, pref.audioLang))?.id ?? null;
}

/** null = ne rien changer ; "no" = désactiver ; number = piste choisie. */
function pickSubtitle(tracks: MpvTrack[], pref: CachedLibraryPref): number | "no" | null {
  const subs = tracks.filter((t) => t.type === "sub" && typeof t.id === "number");
  switch (pref.subtitleMode) {
    case "none":
      return "no";
    case "always": {
      const exact = subs.find((t) => sameLang(t.lang, pref.subtitleLang) && !t.forced);
      return exact?.id ?? subs.find((t) => sameLang(t.lang, pref.subtitleLang))?.id ?? null;
    }
    case "forced":
    case "signs":
      return subs.find((t) => sameLang(t.lang, pref.subtitleLang) && t.forced === true)?.id ?? null;
  }
}

/**
 * À appeler au démarrage d'une lecture LOCALE hors ligne (onStarted).
 * Best-effort : sans préférence en cache ou sans piste correspondante, mpv
 * garde sa sélection par défaut.
 */
export async function applyOfflineTrackSelection(
  userId: string,
  libraryId: string | null,
): Promise<void> {
  const pref = prefForLibrary(userId, libraryId);
  if (!pref) return;
  try {
    await loadMpvApi();
    const api = getMpvApi();
    if (!api) return;
    const tracks = await readTrackList(api);
    if (tracks.length === 0) return;

    const audioId = pickAudio(tracks, pref);
    if (audioId !== null) await api.setProperty("aid", audioId);

    const subtitle = pickSubtitle(tracks, pref);
    if (subtitle === "no") await api.setProperty("sid", "no");
    else if (subtitle !== null) await api.setProperty("sid", subtitle);
  } catch {
    /* mpv indisponible ou track-list illisible : sélection par défaut. */
  }
}
