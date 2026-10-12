import { resolve } from "node:path";
import { CLIENT, WEB } from "./substitutionPaths";

/**
 * Ce que la cible téléviseur remplace dans la FICHE d'`apps/web`. Extraite de
 * `substitutionTable.ts` (au-delà de 300 lignes), qui la fusionne dans sa
 * table des fichiers : données pures, mêmes règles, même greffon.
 */
export const DETAIL_FILES: Record<string, string> = {
  // Le bloc d'actions de la fiche devient une ZONE du moteur de focus :
  // descendre depuis « Retour » ou les infos techniques atterrit sur
  // « Lecture »/« Reprendre », plus sur le trailer que l'ordonnée désignait.
  // L'enveloppe rend l'original tel quel.
  [resolve(WEB, "components/detail/DetailActions.tsx")]:
    resolve(CLIENT, "ui/detail/DetailActionsTv.tsx"),

  // « Vous ne voyez pas les bandes-annonces ? » : au téléviseur, une phrase
  // qui renvoie vers l'app web ou mobile — ni lien ni croix, rien qui entre
  // dans la zone d'actions ou dérange son entrée (le premier bouton du bloc).
  [resolve(WEB, "components/detail/TrailerHelpHint.tsx")]:
    resolve(CLIENT, "ui/detail/TrailerHelpHintTv.tsx"),

  // Le message d'un titre sans métadonnées : au téléviseur, une phrase seule —
  // une TV jumelée n'administre pas Jellyfin (« Réanalyser maintenant » est
  // réservé à une session personnelle) et rien ne s'ajoute au parcours du D-pad.
  [resolve(WEB, "components/detail/MetadataHint.tsx")]:
    resolve(CLIENT, "ui/detail/MetadataHintTv.tsx"),

  // La rangée des extras : son conteneur de défilement gagne `data-tv-piste`
  // — confinement horizontal, défilement suivi — et perd le `tabIndex` qui en
  // faisait une grande cible sans anneau.
  [resolve(WEB, "components/detail/ExtrasRow.tsx")]:
    resolve(CLIENT, "ui/detail/ExtrasRowTv.tsx"),

  // La saga d'un film : la rangée du web est un défileur maison, ses cartes
  // des `<div onClick>` que le moteur ne voit pas. Même données, mais une
  // `data-tv-piste` de `FocusableCard` — comme `TrackTv`.
  [resolve(WEB, "components/detail/saga/SagaSection.tsx")]:
    resolve(CLIENT, "ui/detail/SagaSectionTv.tsx"),

  // Le calque d'ouverture de la fiche est une chorégraphie écrite POUR
  // framer-motion : le shim en écarte `initial`, `animate` et `transition`, et
  // ce qui restait n'était pas une version dégradée mais une avarie — visuel en
  // vol sans dimensions, copie du décor figée à `blur(12px)` faute de
  // l'animation qui devait l'effacer, et une seconde de plein écran avant une
  // disparition sèche. Ce qui le remplace existe déjà : `tv.css` anime
  // `#root > *` en opacité sur 180 ms.
  [resolve(WEB, "components/detail/DetailOpenOverlay.tsx")]:
    resolve(CLIENT, "ui/detail/OpeningOverlayTv.tsx"),
};
