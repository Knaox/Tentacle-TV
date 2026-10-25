/**
 * Octave — la SEULE porte des profils dans Octave : le menu du profil de la
 * coquille et la feuille du code PIN (export stable, contrat `pin-sheet.md` du
 * lot : le démarrage d'Octave l'importe d'ici). Tout ce qui est derrière lit
 * `apps/web/src/profiles/`, que la feuille du client LG ne balaie pas : la
 * cible webOS remplace cette porte par une porte inerte
 * (`apps/tv-webos/config/substitutionTableSession.ts`).
 */

export { OctaveProfileButton } from "./OctaveProfileButton";
export { OctavePinSheet, type OctavePinSheetProps } from "./OctavePinSheet";
