/**
 * Préférence « sauter l'intro toute seule » — réglage PAR APPAREIL, comme la
 * bascule HDR et le Liquid Glass.
 *
 * Par appareil et non par compte : sauter l'intro se décide devant l'écran, pas
 * dans un profil. On la veut sur le téléviseur du salon qu'on enchaîne le soir,
 * rarement sur le portable où l'on reprend une série de loin en loin. Le
 * stockage local a aussi l'avantage de répondre hors ligne, là où une
 * préférence serveur laisserait le lecteur sans réponse.
 *
 * ALLUMÉE par défaut, sur tous les appareils. On enchaîne les épisodes le soir,
 * et regarder trois fois le même générique en une heure n'a jamais été le but ;
 * le saut reste annulable au cas par cas — trois secondes et une croix.
 *
 * Ce qui est lu, c'est donc l'ABSENCE de refus : seule la chaîne `"false"`,
 * écrite par quelqu'un qui a explicitement éteint le réglage, l'éteint. Un
 * stockage vide, une session privée, un appareil neuf : allumé. Un choix déjà
 * posé, dans un sens ou dans l'autre, est respecté tel quel.
 */

export const AUTO_SKIP_INTRO_STORAGE_KEY = "tentacle_auto_skip_intro";

const read = (): boolean => {
  try {
    // `!== "false"` et non `=== "true"` : c'est ce qui fait du défaut un OUI
    // sans rien avoir à écrire à la première visite.
    return localStorage.getItem(AUTO_SKIP_INTRO_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
};

let enabled = read();
const listeners = new Set<() => void>();

export const getAutoSkipIntro = (): boolean => enabled;

export function setAutoSkipIntro(next: boolean): void {
  enabled = next;
  try {
    localStorage.setItem(AUTO_SKIP_INTRO_STORAGE_KEY, String(next));
  } catch {
    /* Persistance impossible : vaut pour la session en cours. */
  }
  for (const l of listeners) l();
}

export function subscribeAutoSkipIntro(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
