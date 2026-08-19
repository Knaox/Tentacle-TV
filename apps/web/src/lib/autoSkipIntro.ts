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
 * Éteinte par défaut : un lecteur qui décide seul de déplacer la tête de
 * lecture doit avoir été demandé. Une fois allumée, le saut reste annulable au
 * cas par cas — trois secondes et une croix.
 */

export const AUTO_SKIP_INTRO_STORAGE_KEY = "tentacle_auto_skip_intro";

const read = (): boolean => {
  try {
    return localStorage.getItem(AUTO_SKIP_INTRO_STORAGE_KEY) === "true";
  } catch {
    return false;
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
