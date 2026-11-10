/**
 * Labo d'Octave — les SCÈNES : une adresse d'Octave, un état du lecteur, et ce que le faux serveur
 * retient ou refuse. `?vue=<scène>` en choisit une. Les calques (file, lecteur plein écran, menu,
 * boîte de dialogue) s'ouvrent par un clic sur le vrai bouton — le banc de capture le fait.
 */

import { labId } from "./data/labIds";
import { CURRENT_ALBUM_ID } from "./data/labTracks";
import { EMPTY_PLAYLIST_ID, MAIN_PLAYLIST_ID } from "./data/labPlaylists";
import { NO_RULES, type LabServerRules } from "./labServer";
import type { LabPlayerState } from "./labPlayer";

export interface LabScene {
  /** L'adresse ouverte dans Octave (`/octave/…`). */
  path: string;
  player: LabPlayerState;
  rules: LabServerRules;
  /** Ce que la scène montre (le titre de la page du labo). */
  label: string;
}

const ALBUM_PATH = `/octave/album/${CURRENT_ALBUM_ID}`;
const PLAYLIST_PATH = `/octave/playlist/${MAIN_PLAYLIST_ID}`;
/** Un album qui n'est PAS celui qui joue : son attente et son erreur ne touchent pas le lecteur. */
const OTHER_ALBUM = labId("al-canal");
const OTHER_ALBUM_ROUTE = new RegExp(`^/api/music/albums/${OTHER_ALBUM}$`);

const scene = (label: string, path: string, player: LabPlayerState = "playing", rules: Partial<LabServerRules> = {}): LabScene => ({
  label,
  path,
  player,
  rules: { ...NO_RULES, ...rules },
});

export const LAB_SCENES = {
  accueil: scene("Accueil, rien en cours", "/octave", "idle"),
  "accueil-lecture": scene("Accueil, un titre joue", "/octave"),
  album: scene("Album (le titre en cours est une de ses rangées)", ALBUM_PATH),
  artiste: scene("Artiste", `/octave/artist/${labId("ar-vasseur")}`),
  playlist: scene("Playlist", PLAYLIST_PATH),
  bibliotheque: scene("Bibliothèque", "/octave/library"),
  "titres-aimes": scene("Titres likés", "/octave/liked"),
  playlists: scene("Playlists", "/octave/playlists"),
  recherche: scene("Recherche, avec résultats", "/octave/search?q=nuit"),
  "recherche-accueil": scene("Recherche, avant de chercher", "/octave/search"),
  file: scene("File « À suivre » (à ouvrir par son bouton)", ALBUM_PATH),
  "en-cours": scene("Lecteur plein écran (à ouvrir par la pochette du dock)", "/octave"),
  menu: scene("Menu « … » d'un titre (à ouvrir par son bouton)", ALBUM_PATH),
  feuille: scene("Boîte de dialogue (à ouvrir depuis la playlist)", PLAYLIST_PATH),
  vide: scene("Playlist vide", `/octave/playlist/${EMPTY_PLAYLIST_ID}`),
  "vide-aimes": scene("Aucun titre aimé", "/octave/liked", "idle", { emptyLiked: true }),
  erreur: scene("Vue en erreur, avec « Réessayer »", `/octave/album/${OTHER_ALBUM}`, "playing", { fail: [OTHER_ALBUM_ROUTE] }),
  chargement: scene("Squelettes d'une vue", `/octave/album/${OTHER_ALBUM}`, "playing", { hold: [OTHER_ALBUM_ROUTE] }),
  "chargement-accueil": scene("Squelettes de l'accueil", "/octave", "idle", { hold: [/^\/api\/music\/home$/] }),
  appareil: scene("Sur cet appareil", "/octave/device"),
  reglages: scene("Réglages d'Octave", "/octave/settings"),
  pause: scene("Dock en pause", ALBUM_PATH, "paused"),
} as const satisfies Record<string, LabScene>;

export type LabSceneName = keyof typeof LAB_SCENES;

export const LAB_SCENE_NAMES = Object.keys(LAB_SCENES) as LabSceneName[];

/** La scène demandée par l'adresse (`?vue=`) ; l'accueil en lecture à défaut. */
export function sceneFromLocation(): LabSceneName {
  const asked = new URLSearchParams(window.location.search).get("vue") ?? "";
  return (LAB_SCENE_NAMES as readonly string[]).includes(asked) ? (asked as LabSceneName) : "accueil-lecture";
}
