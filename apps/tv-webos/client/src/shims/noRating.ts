/**
 * La notation par étoiles, retirée du téléviseur.
 *
 * Cinq étoiles à dix niveaux se pilotent à la souris — une demi-étoile par
 * moitié de glyphe. À la télécommande, chaque demi-étoile devenait une cible du
 * D-pad : dix arrêts pour traverser une ligne, et l'anneau de focus, calibré
 * pour une affiche, débordait de glyphes de vingt pixels. Noter reste possible
 * depuis le téléphone ou l'ordinateur ; la note, elle, reste affichée là où
 * elle se lit (lignes d'épisode, pastilles du lecteur).
 *
 * Un même module répond aux trois imports, comme `inert.ts` : chacun trouve
 * son export nommé, et tous rendent `null`.
 *
 *  - `StarRating` : le filet — toute saisie d'étoiles oubliée ailleurs ;
 *  - `DetailRating` : la pastille « Votre note » de la fiche, libellé compris ;
 *  - `EndCardRatingRow` : la rangée « Noter l'épisode » de l'affiche de fin.
 */

export function StarRating(): null {
  return null;
}

export function DetailRating(): null {
  return null;
}

export function EndCardRatingRow(): null {
  return null;
}
