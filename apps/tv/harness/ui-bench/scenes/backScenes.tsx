import { BROWSE_SCENES } from "./browseScenes";
import { DETAIL_SCENES } from "./detailScenes";
import { OVERLAY_SCENES } from "./overlayScenes";
import { PAIRING_SCENES } from "./pairingScenes";
import { PLAYER_SCENES } from "./playerScenes";
import { SHEET_SCENES } from "./sheetScenes";
import { TRAILER_SCENES } from "./trailerScenes";
import type { BenchScene } from "./types";

/**
 * La croix Retour, une scène par endroit (`BackButton`) : la même croix,
 * toujours en haut à gauche de ce qu'elle referme. Chaque scène reprend celle
 * de son écran et ne fige que deux focus — l'entrée (la croix au repos) puis
 * la croix — ou la croix seule là où elle EST l'entrée (seule action).
 *
 *   bench:ui planche retour --focus
 */

const ALL = [...DETAIL_SCENES, ...BROWSE_SCENES, ...PLAYER_SCENES, ...SHEET_SCENES, ...OVERLAY_SCENES, ...PAIRING_SCENES, ...TRAILER_SCENES];

function from(sourceId: string, id: string, label: string, focusKeys: string[]): BenchScene {
  const source = ALL.find((scene) => scene.id === sourceId);
  if (!source) throw new Error(`scène ${sourceId} absente du catalogue`);
  return { ...source, id: `retour/${id}`, group: "Retour", label, focusKeys };
}

export const BACK_SCENES: BenchScene[] = [
  from("fiche/film-saga", "fiche", "Fiche — film", ["detail:primary", "detail:back"]),
  from("fiche/serie", "fiche-serie", "Fiche — série", ["detail:primary", "detail:back"]),
  from("fiche/episode", "fiche-episode", "Fiche — épisode", ["detail:primary", "detail:back"]),
  from("fiche/collection", "fiche-collection", "Fiche — collection", ["collection:0", "detail:back"]),
  from("fiche/erreur", "fiche-erreur", "Fiche — erreur", ["status:primary", "detail:back"]),
  from("parcourir/personne", "personne", "Parcourir — personne", ["grid:0", "browse:back"]),
  from("parcourir/vide", "parcourir-vide", "Parcourir — vide : seule action", ["browse:back"]),
  from("feuille/affiche", "panneau", "Grand panneau", ["sheet:scale:5", "sheet:close"]),
  from("lecteur/resolution", "lecteur-ouverture", "Lecteur — ouverture : seule action", ["loading:back"]),
  from("lecteur/echec", "lecteur-echec", "Lecteur — échec de l'ouverture", ["loading:retry", "loading:back"]),
  from("lecteur/osd-film", "lecteur-habillage", "Lecteur — habillage", ["player:playpause", "player:back"]),
  from("lecteur/pistes", "lecteur-pistes", "Lecteur — pistes", ["tracks:audio:2", "tracks:close"]),
  from("lecteur/episodes", "lecteur-episodes", "Lecteur — épisodes", ["episodes:episode:2", "episodes:close"]),
  from("surimpressions/erreur-ecran", "erreur-ecran", "Erreur d'écran", ["screenError:retry", "screenError:back"]),
  from("jumelage/serveur", "jumelage-serveur", "Jumelage — serveur manuel", ["pairing:url", "pairing:back"]),
  from("jumelage/code-actif", "jumelage-relais", "Jumelage — code du relais : seule action", ["pairing:back"]),
  from("bande-annonce/lecture", "bande-annonce", "Bande-annonce — seule action", ["trailer:close"]),
  from("bande-annonce/indisponible", "bande-annonce-indisponible", "Bande-annonce indisponible — seule action", ["trailer:close"]),
];
