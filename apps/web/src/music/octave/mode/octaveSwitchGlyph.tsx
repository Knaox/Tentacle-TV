/**
 * Octave — ce que porte le pouce de la bascule : UN SEUL point d'import, le
 * GLYPHE d'interface d'Octave (`OctaveGlyph`, la croche dont le crochet est un
 * bras, généré par `brand/octave_glyph.py`). Il prend `currentColor` : la
 * feuille de la bascule le teinte selon l'état (encre éteint, rose allumé).
 * La mascotte au tricorne reste le LOGO d'Octave partout ailleurs ; dans la
 * bascule, Damien préfère la note (26/10).
 */

export { OctaveGlyph as OctaveSwitchGlyph } from "../../../components/ui/OctaveGlyph";
